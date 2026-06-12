"use client";

import { useState, useEffect } from "react";
import type { TeamSheet, MatchEvent } from "@/types";

interface Props {
  home: TeamSheet;
  away: TeamSheet;
  events: MatchEvent[];
}

/**
 * Below-pitch panel: coach/formation, tactics skeleton, subs list, why watch.
 * Tactics are generated client-side via /api/scout (reuses LLM provider).
 */
export default function MatchInfo({ home, away, events }: Props) {
  const [whyWatch, setWhyWatch] = useState<string>("");
  const [loadingWhy, setLoadingWhy] = useState(false);

  // "Why watch" note — generate once for the underdog team (away by convention for now)
  useEffect(() => {
    let cancelled = false;
    async function fetchWhyWatch() {
      if (loadingWhy || whyWatch) return;
      setLoadingWhy(true);
      try {
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            players: [], // empty — we only want the why-watch note
            teamCountry: away.teamName,
            whyWatch: true,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          if (data.whyWatch) setWhyWatch(data.whyWatch);
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setLoadingWhy(false);
      }
    }
    fetchWhyWatch();
    return () => { cancelled = true; };
  }, [away.teamName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recent subs
  const subs = events.filter((e) => e.type === "subst");
  const recentGoals = events.filter((e) => e.type === "Goal");

  return (
    <div className="match-info">
      {/* Formations */}
      <div className="match-info__section">
        <div className="match-info__label">Formations</div>
        <div className="tactics-grid">
          <div className="tactics-cell">
            <div className="tactics-cell__key">{home.teamName}</div>
            <div className="tactics-cell__val">
              {home.formation.raw || "–"} · {home.coach}
            </div>
          </div>
          <div className="tactics-cell">
            <div className="tactics-cell__key">{away.teamName}</div>
            <div className="tactics-cell__val">
              {away.formation.raw || "–"} · {away.coach}
            </div>
          </div>
        </div>
      </div>

      {/* Goals */}
      {recentGoals.length > 0 && (
        <div className="match-info__section">
          <div className="match-info__label">Goals</div>
          <div className="match-info__text">
            {recentGoals.map((g, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                ⚽ {g.minute}′ {g.playerOut ?? "Unknown"}
                {g.detail ? ` (${g.detail})` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Substitutions */}
      {subs.length > 0 && (
        <div className="match-info__section">
          <div className="match-info__label">Substitutions</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {subs.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {s.minute}′ <span style={{ color: "#4caf6e" }}>↑ {s.playerIn ?? "?"}</span>
                {" / "}
                <span style={{ color: "#f87171" }}>↓ {s.playerOut ?? "?"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Why watch */}
      <div className="match-info__section">
        <div className="match-info__label">Why Watch This Match</div>
        <div className="player-card__scout" style={{ fontStyle: "normal" }}>
          {whyWatch
            ? whyWatch
            : loadingWhy
            ? <span style={{ color: "var(--text-muted)" }}>Generating…</span>
            : <span style={{ color: "var(--text-muted)" }}>–</span>
          }
        </div>
      </div>

      {/* Home league note */}
      <div className="match-info__section" style={{ marginBottom: 0 }}>
        <div className="match-info__label">About the squads</div>
        <div className="match-info__text">
          Tap any player on the pitch to see their playing style, club, and league tier.
        </div>
      </div>
    </div>
  );
}
