"use client";

/**
 * World Cup Companion — Main Page
 *
 * Orchestration:
 * 1. Fetch /api/fixtures → find live match or next upcoming
 * 2. Auto-select a live match (or show upcoming + fixture list)
 * 3. Fetch /api/lineup for the selected match
 * 4. Fetch /api/events on smart schedule:
 *    - Confirm XI at kickoff (status transitions from NS → 1H)
 *    - One check just after HT restart (~min 46)
 *    - Every 3 min from min 60 → final whistle
 *    - Keep polling through ET (status ET/BT/P) up to 120+
 * 5. Batch-request /api/scout for all players (cached server-side)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import PitchView from "@/components/PitchView";
import MatchInfo from "@/components/MatchInfo";
import Countdown from "@/components/Countdown";
import Legend from "@/components/Legend";
import type { Fixture, TeamSheet, MatchEvent, Player } from "@/types";
import { LIVE_STATUSES } from "@/types";

// ── Polling interval logic ─────────────────────────────────────────────────

function getPollingIntervalMs(status: string, minute: number | null): number | null {
  if (!LIVE_STATUSES.includes(status as any)) return null; // not live → no polling

  const min = minute ?? 0;

  // HT: poll at ~46' to catch the restart
  if (status === "HT") return 30_000; // check every 30s during break

  // Early in first half (1–45): subs are very rare → poll infrequently
  if (status === "1H" && min < 44) return 5 * 60_000; // every 5 min

  // Just after HT restart (45–60)
  if ((status === "2H" || status === "1H") && min < 60) return 60_000; // 1 min

  // 60'+ through final whistle (and ET)
  return 3 * 60_000; // 3 min
}

// ── Formatters ─────────────────────────────────────────────────────────────

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatKickoffDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function statusLabel(status: string, minute: number | null): string {
  if (status === "HT") return "Half Time";
  if (status === "1H") return `${minute ?? 0}'`;
  if (status === "2H") return `${minute ?? 0}'`;
  if (status === "ET") return `ET ${minute ?? 0}'`;
  if (status === "BT") return "ET Break";
  if (status === "P")  return "Penalties";
  if (status === "FT") return "Full Time";
  if (status === "AET") return "AET";
  if (status === "PEN") return "Pen.";
  return status;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function Home() {
  // ── State
  const [fixtures, setFixtures] = useState<{
    live: Fixture[];
    today: Fixture[];
    nextUpcoming: Fixture | null;
  } | null>(null);

  const [selectedFixtureId, setSelectedFixtureId] = useState<number | null>(null);
  const [liveStatus, setLiveStatus] = useState<{ status: string; minute: number | null; homeScore: number | null; awayScore: number | null } | null>(null);

  const [home, setHome] = useState<TeamSheet | null>(null);
  const [away, setAway] = useState<TeamSheet | null>(null);
  const [lineupConfirmed, setLineupConfirmed] = useState(false);
  const [lineupWaiting, setLineupWaiting] = useState(false);
  const [lineupError, setLineupError] = useState<string | null>(null);

  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");

  const [pasteValue, setPasteValue] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [fixturesError, setFixturesError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoutFetchedRef = useRef<Set<number>>(new Set());

  // ── Fetch fixture list on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/fixtures");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setFixtures(data);

        // Auto-select: first live match, else next upcoming
        if (data.live?.length > 0) {
          setSelectedFixtureId(data.live[0].id);
        } else if (data.nextUpcoming) {
          setSelectedFixtureId(data.nextUpcoming.id);
        }
      } catch (err: any) {
        setFixturesError(err.message ?? "Failed to load fixtures");
      }
    }
    load();
  }, []);

  // ── Fetch lineup when fixture selected
  useEffect(() => {
    if (!selectedFixtureId) return;
    setHome(null);
    setAway(null);
    setLineupConfirmed(false);
    setLineupError(null);
    setEvents([]);
    scoutFetchedRef.current = new Set();

    async function fetchLineup() {
      setLineupWaiting(true);
      try {
        const res = await fetch(`/api/lineup?fixtureId=${selectedFixtureId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (data.confirmed && data.home && data.away) {
          setHome(data.home);
          setAway(data.away);
          setLineupConfirmed(true);
        } else {
          setLineupWaiting(true);
        }
      } catch (err: any) {
        setLineupError(err.message ?? "Failed to load lineup");
      } finally {
        setLineupWaiting(false);
      }
    }
    fetchLineup();
  }, [selectedFixtureId]);

  // ── Fetch events + live status (smart polling)
  const fetchEvents = useCallback(async () => {
    if (!selectedFixtureId) return;
    try {
      const res = await fetch(`/api/events?fixtureId=${selectedFixtureId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.error) return;

      setEvents(data.events ?? []);
      setLiveStatus({
        status: data.status ?? "NS",
        minute: data.minute,
        homeScore: data.homeScore,
        awayScore: data.awayScore,
      });

      // Re-fetch lineup if it wasn't confirmed yet but match is now live
      if (!lineupConfirmed && LIVE_STATUSES.includes(data.status)) {
        const lres = await fetch(`/api/lineup?fixtureId=${selectedFixtureId}`);
        const ldata = await lres.json();
        if (ldata.confirmed && ldata.home && ldata.away) {
          setHome(ldata.home);
          setAway(ldata.away);
          setLineupConfirmed(true);
        }
      }
    } catch {
      // non-fatal
    }
  }, [selectedFixtureId, lineupConfirmed]);

  // Schedule next poll based on current match status
  useEffect(() => {
    if (!selectedFixtureId) return;
    if (pollingRef.current) clearTimeout(pollingRef.current);

    const interval = liveStatus
      ? getPollingIntervalMs(liveStatus.status, liveStatus.minute)
      : null;

    if (interval) {
      pollingRef.current = setTimeout(() => {
        fetchEvents();
      }, interval);
    }

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [selectedFixtureId, liveStatus, fetchEvents]);

  // Initial events fetch when fixture is selected
  useEffect(() => {
    if (selectedFixtureId) fetchEvents();
  }, [selectedFixtureId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch scout notes after lineup loads
  useEffect(() => {
    if (!lineupConfirmed || !home || !away) return;

    const allPlayers = [...home.starters, ...home.subs, ...away.starters, ...away.subs];
    const unfetched = allPlayers.filter(
      (p) => p.id && !scoutFetchedRef.current.has(p.id) && !p.scoutNote
    );
    if (unfetched.length === 0) return;

    async function fetchScout(players: Player[], teamCountry: string) {
      try {
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: players.map((p) => ({
              id: p.id, name: p.name, pos: p.pos,
              club: p.club, clubLeague: p.clubLeague, leagueTier: p.leagueTier,
            })),
            teamCountry,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const notes: Record<number, string> = data.notes ?? {};

        // Inject notes into state
        setHome((prev) => prev ? injectNotes(prev, notes) : prev);
        setAway((prev) => prev ? injectNotes(prev, notes) : prev);

        players.forEach((p) => scoutFetchedRef.current.add(p.id));
      } catch {
        // non-fatal
      }
    }

    const homePlayers = [...home.starters, ...home.subs].filter(
      (p) => p.id && !scoutFetchedRef.current.has(p.id)
    );
    const awayPlayers = [...away.starters, ...away.subs].filter(
      (p) => p.id && !scoutFetchedRef.current.has(p.id)
    );

    if (homePlayers.length) fetchScout(homePlayers, home.teamCountry);
    if (awayPlayers.length) fetchScout(awayPlayers, away.teamCountry);
  }, [lineupConfirmed, home?.teamId, away?.teamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers
  function injectNotes(sheet: TeamSheet, notes: Record<number, string>): TeamSheet {
    function enrich(players: Player[]): Player[] {
      return players.map((p) =>
        notes[p.id] ? { ...p, scoutNote: notes[p.id] } : p
      );
    }
    return { ...sheet, starters: enrich(sheet.starters), subs: enrich(sheet.subs) };
  }

  const selectedFixture = fixtures
    ? [...(fixtures.live ?? []), ...(fixtures.today ?? [])].find(
        (f) => f.id === selectedFixtureId
      )
    : null;

  const isLive = liveStatus && LIVE_STATUSES.includes(liveStatus.status as any);
  const activeSheet = activeTeam === "home" ? home : away;

  // ── Render: loading
  if (!fixtures && !fixturesError) {
    return (
      <div className="app-shell">
        <div className="waiting-state" style={{ flex: 1 }}>
          <div className="spinner" />
          <div className="waiting-state__text">Loading fixtures…</div>
        </div>
      </div>
    );
  }

  // ── Render: fixtures error
  if (fixturesError) {
    return (
      <div className="app-shell">
        <div className="waiting-state">
          <div className="waiting-state__icon">⚠️</div>
          <div className="waiting-state__title">Couldn't load fixtures</div>
          <div className="waiting-state__text">{fixturesError}</div>
          <button className="btn btn--outline" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render: no fixtures today / upcoming
  if (fixtures && fixtures.live.length === 0 && !fixtures.nextUpcoming && fixtures.today.length === 0) {
    return (
      <div className="app-shell">
        <header className="header">
          <div className="header__title">World Cup Companion</div>
          <div className="header__teams">2026 FIFA World Cup</div>
        </header>
        <div className="waiting-state">
          <div className="waiting-state__icon">🌍</div>
          <div className="waiting-state__title">No matches right now</div>
          <div className="waiting-state__text">
            No matches are scheduled today. Check back when the tournament begins.
          </div>
        </div>
      </div>
    );
  }

  // ── Render: upcoming / pre-match
  if (!isLive && !lineupConfirmed && fixtures?.nextUpcoming && !selectedFixture) {
    const next = fixtures.nextUpcoming;
    return (
      <div className="app-shell">
        <header className="header">
          <div className="header__title">World Cup 2026</div>
          <div className="header__round" style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {formatKickoffDate(next.kickoff)}
          </div>
        </header>

        <div className="waiting-state">
          <div className="waiting-state__icon">⚽</div>
          <div className="waiting-state__title">{next.homeTeam} vs {next.awayTeam}</div>
          <div className="waiting-state__text">
            Kicks off at {formatKickoff(next.kickoff)} (your local time) · {next.venue}
          </div>
          <Countdown kickoff={next.kickoff} />
          <div className="waiting-state__text" style={{ fontSize: 12 }}>
            Team sheet expected ~30–40 min before kickoff
          </div>
        </div>

        {fixtures.today.length > 0 && (
          <>
            <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
              Today's Fixtures
            </div>
            <ul className="fixture-list">
              {fixtures.today.map((f) => (
                <li key={f.id}>
                  <button
                    className="fixture-row"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => setSelectedFixtureId(f.id)}
                  >
                    <span className="fixture-row__teams">{f.homeTeam} vs {f.awayTeam}</span>
                    <span className="fixture-row__time">{formatKickoff(f.kickoff)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // ── Render: match selected (live or pre)
  const score = liveStatus
    ? `${liveStatus.homeScore ?? "–"} – ${liveStatus.awayScore ?? "–"}`
    : "– –";

  const minuteLabel = liveStatus ? statusLabel(liveStatus.status, liveStatus.minute) : "Pre-match";

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="header">
        <div>
          <div className="header__title">World Cup 2026</div>
          {selectedFixture && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>
              {selectedFixture.round}
            </div>
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <div className="header__score">{score}</div>
          {isLive ? (
            <div className="live-badge" style={{ margin: "2px auto 0" }}>
              <span className="live-badge__dot" />
              {minuteLabel}
            </div>
          ) : (
            <div className="header__teams" style={{ marginTop: 2 }}>{minuteLabel}</div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          {selectedFixture && (
            <div className="header__round">
              {formatKickoff(selectedFixture.kickoff)}
            </div>
          )}
        </div>
      </header>

      {/* Multi-match switcher */}
      {fixtures && fixtures.live.length > 1 && (
        <div className="switcher">
          {fixtures.live.map((f) => (
            <button
              key={f.id}
              className={`switcher__btn${f.id === selectedFixtureId ? " switcher__btn--active" : ""}`}
              onClick={() => setSelectedFixtureId(f.id)}
            >
              {f.homeTeam} vs {f.awayTeam}
            </button>
          ))}
        </div>
      )}

      {/* Team tabs */}
      {lineupConfirmed && home && away && (
        <div className="team-tabs">
          <button
            className={`team-tab${activeTeam === "home" ? " team-tab--active" : ""}`}
            onClick={() => setActiveTeam("home")}
          >
            {home.teamName}
          </button>
          <button
            className={`team-tab${activeTeam === "away" ? " team-tab--active" : ""}`}
            onClick={() => setActiveTeam("away")}
          >
            {away.teamName}
          </button>
        </div>
      )}

      {/* Pitch */}
      <div className="pitch-wrapper">
        {lineupConfirmed && activeSheet ? (
          <PitchView sheet={activeSheet} events={events} />
        ) : lineupWaiting ? (
          <div className="waiting-state">
            <div className="spinner" />
            <div className="waiting-state__text">Fetching lineup…</div>
          </div>
        ) : lineupError ? (
          <div className="waiting-state">
            <div className="waiting-state__icon">⚠️</div>
            <div className="waiting-state__title">Lineup unavailable</div>
            <div className="waiting-state__text">{lineupError}</div>
          </div>
        ) : (
          <div className="waiting-state">
            <div className="waiting-state__icon">📋</div>
            <div className="waiting-state__title">Waiting for team sheet</div>
            <div className="waiting-state__text">
              Confirmed lineups usually arrive 30–40 minutes before kickoff.
              The app will auto-update when they're confirmed.
            </div>
            <button
              className="btn btn--outline"
              style={{ marginTop: 8 }}
              onClick={() => setShowPaste(!showPaste)}
            >
              {showPaste ? "Hide paste fallback" : "Paste lineup manually"}
            </button>
          </div>
        )}
      </div>

      {/* Paste fallback */}
      {showPaste && !lineupConfirmed && (
        <div className="paste-fallback">
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
            Paste a lineup (one player per line, format: "#num Name Pos Club"):
          </div>
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder={"1 Pickford GK Everton\n2 Trippier D Newcastle\n…"}
          />
          <button className="btn" style={{ marginTop: 8, width: "100%" }} onClick={() => {
            // Basic parser — "#num Name POS Club"
            const lines = pasteValue.trim().split("\n").filter(Boolean);
            const parsed: Player[] = lines.map((line, i) => {
              const parts = line.trim().split(/\s+/);
              const number = parseInt(parts[0], 10) || i + 1;
              const pos = parts[parts.length - 2] ?? "?";
              const club = parts[parts.length - 1] ?? "?";
              const name = parts.slice(1, parts.length - 2).join(" ") || "Player";
              return {
                id: -(i + 1),
                name, number, pos, club,
                clubLeague: "", clubLeagueCountry: "",
                leagueTier: "minor",
                bornAbroad: false,
              };
            });
            const fakeSheet: TeamSheet = {
              teamId: 0, teamName: "Manual", teamCountry: "Manual",
              coach: "–",
              formation: { raw: "4-3-3", lines: [4, 3, 3] },
              starters: parsed.slice(0, 11),
              subs: parsed.slice(11),
              confirmed: true,
            };
            if (activeTeam === "home") setHome(fakeSheet);
            else setAway(fakeSheet);
            setLineupConfirmed(true);
            setShowPaste(false);
          }}>
            Use this lineup
          </button>
        </div>
      )}

      {/* Legend */}
      {lineupConfirmed && <Legend />}

      {/* Match info (below pitch) */}
      {lineupConfirmed && home && away && (
        <MatchInfo home={home} away={away} events={events} />
      )}

      {/* Fixture list (if match selected but also want to switch) */}
      {fixtures && fixtures.today.length > 1 && !lineupConfirmed && (
        <>
          <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
            All Today's Fixtures
          </div>
          <ul className="fixture-list" style={{ marginBottom: "var(--safe-bottom)" }}>
            {fixtures.today.map((f) => (
              <li key={f.id}>
                <button
                  className="fixture-row"
                  style={{ width: "100%", textAlign: "left" }}
                  onClick={() => setSelectedFixtureId(f.id)}
                >
                  <span className="fixture-row__teams">{f.homeTeam} vs {f.awayTeam}</span>
                  <span className="fixture-row__time">
                    {LIVE_STATUSES.includes(f.status as any)
                      ? <span style={{ color: "#dc2626" }}>LIVE</span>
                      : formatKickoff(f.kickoff)
                    }
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
