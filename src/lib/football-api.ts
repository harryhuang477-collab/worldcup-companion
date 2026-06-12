/**
 * football-data.org API wrapper.
 * Free tier covers the 2026 FIFA World Cup.
 * Docs: https://www.football-data.org/documentation/quickstart
 *
 * Competition code: WC (FIFA World Cup)
 */

import type { Fixture, FixtureStatus, TeamSheet, MatchEvent, Player } from "@/types";

const BASE = "https://api.football-data.org/v4";
const COMPETITION = "WC";

function headers() {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("FOOTBALL_API_KEY is not set");
  return { "X-Auth-Token": key };
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: headers(), next: { revalidate: 0 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`football-data.org ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function mapStatus(s: string, minute?: number | null): FixtureStatus {
  switch (s) {
    case "SCHEDULED":
    case "TIMED":          return "NS";
    case "IN_PLAY":        return (minute ?? 0) <= 45 ? "1H" : "2H";
    case "PAUSED":         return "HT";
    case "EXTRA_TIME":     return "ET";
    case "PENALTY_SHOOTOUT": return "P";
    case "FINISHED":
    case "AWARDED":        return "FT";
    case "POSTPONED":      return "PST";
    case "SUSPENDED":      return "SUSP";
    case "CANCELLED":      return "CANC";
    default:               return "NS";
  }
}

function normalizeFixture(m: any): Fixture {
  const minute = m.minute ?? null;
  return {
    id: m.id,
    homeTeam: m.homeTeam?.name ?? "TBD",
    homeTeamId: m.homeTeam?.id ?? 0,
    awayTeam: m.awayTeam?.name ?? "TBD",
    awayTeamId: m.awayTeam?.id ?? 0,
    kickoff: m.utcDate,
    status: mapStatus(m.status, minute),
    minute,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    round: m.stage ?? m.group ?? "",
    venue: m.venue ?? "",
  };
}

export async function getLiveFixtures(): Promise<Fixture[]> {
  try {
    // football-data.org uses IN_PLAY and PAUSED for live matches
    const [inPlay, paused, et, pen] = await Promise.all([
      apiFetch<any>(`/competitions/${COMPETITION}/matches?status=IN_PLAY`),
      apiFetch<any>(`/competitions/${COMPETITION}/matches?status=PAUSED`),
      apiFetch<any>(`/competitions/${COMPETITION}/matches?status=EXTRA_TIME`),
      apiFetch<any>(`/competitions/${COMPETITION}/matches?status=PENALTY_SHOOTOUT`),
    ]);
    const all = [
      ...(inPlay.matches ?? []),
      ...(paused.matches ?? []),
      ...(et.matches ?? []),
      ...(pen.matches ?? []),
    ];
    // Deduplicate
    const seen = new Set<number>();
    return all.filter((m: any) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
      .map(normalizeFixture);
  } catch { return []; }
}

export async function getTodayFixtures(): Promise<Fixture[]> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const data = await apiFetch<any>(`/competitions/${COMPETITION}/matches?dateFrom=${today}&dateTo=${today}`);
    return (data.matches ?? []).map(normalizeFixture);
  } catch { return []; }
}

export async function getUpcomingFixtures(): Promise<Fixture[]> {
  try {
    // football-data.org uses both SCHEDULED and TIMED for upcoming matches
    const [scheduled, timed] = await Promise.all([
      apiFetch<any>(`/competitions/${COMPETITION}/matches?status=SCHEDULED`),
      apiFetch<any>(`/competitions/${COMPETITION}/matches?status=TIMED`),
    ]);
    const all = [...(scheduled.matches ?? []), ...(timed.matches ?? [])];
    const seen = new Set<number>();
    return all
      .filter((m: any) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
      .map(normalizeFixture)
      .sort((a: Fixture, b: Fixture) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      .slice(0, 10);
  } catch { return []; }
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  try {
    const data = await apiFetch<any>(`/matches/${id}`);
    return normalizeFixture(data);
  } catch { return null; }
}

export async function getLineups(fixtureId: number): Promise<{ home: TeamSheet; away: TeamSheet } | null> {
  // Try football-data.org first (only works during match when lineup is confirmed)
  try {
    const data = await apiFetch<any>(`/matches/${fixtureId}`);
    const homeLineup: any[] = data.homeTeam?.lineup ?? [];
    const awayLineup: any[] = data.awayTeam?.lineup ?? [];
    if (homeLineup.length > 0 || awayLineup.length > 0) {
      return {
        home: buildTeamSheet(data.homeTeam),
        away: buildTeamSheet(data.awayTeam),
      };
    }
  } catch { /* fall through */ }

  // Fallback: TheSportsDB free API (no key needed, has pre-match lineups)
  return getLineupsFromSportsDB(fixtureId);
}

/**
 * TheSportsDB (free, no key) lineup fetcher.
 * Strategy: fetch today's WC events from TheSportsDB, match by kickoff time
 * to our fixture, then call lookuplineup with the TheSportsDB event ID.
 */
async function getLineupsFromSportsDB(fixtureId: number): Promise<{ home: TeamSheet; away: TeamSheet } | null> {
  try {
    // 1. Get our fixture's kickoff time from football-data.org
    const fdMatch = await apiFetch<any>(`/matches/${fixtureId}`);
    if (!fdMatch?.utcDate) return null;
    const kickoffDate = fdMatch.utcDate.slice(0, 10); // "2026-06-12"
    const kickoffTs = new Date(fdMatch.utcDate).getTime();
    const homeTeamName: string = fdMatch.homeTeam?.name ?? "";
    const awayTeamName: string = fdMatch.awayTeam?.name ?? "";

    // 2. Get TheSportsDB events for that date, WC league (4429)
    const tsdbUrl = `https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${kickoffDate}&l=4429`;
    const tsdbRes = await fetch(tsdbUrl, { cache: "no-store" });
    const tsdbData = await tsdbRes.json();
    const events: any[] = tsdbData.events ?? [];

    // 3. Match event by kickoff timestamp (within 5 min) or team name
    let tsdbEvent = events.find((e: any) => {
      if (!e.strTimestamp) return false;
      const diff = Math.abs(new Date(e.strTimestamp).getTime() - kickoffTs);
      return diff < 5 * 60 * 1000; // within 5 minutes
    });
    // fallback: match by home team name substring
    if (!tsdbEvent && homeTeamName) {
      tsdbEvent = events.find((e: any) =>
        e.strHomeTeam?.toLowerCase().includes(homeTeamName.toLowerCase().split(" ")[0]) ||
        homeTeamName.toLowerCase().includes((e.strHomeTeam ?? "").toLowerCase().split(" ")[0])
      );
    }
    if (!tsdbEvent) return null;

    const tsdbEventId = tsdbEvent.idEvent;
    const tsdbHomeTeam = tsdbEvent.strHomeTeam ?? homeTeamName;
    const tsdbAwayTeam = tsdbEvent.strAwayTeam ?? awayTeamName;

    // 4. Fetch lineup
    const lineupUrl = `https://