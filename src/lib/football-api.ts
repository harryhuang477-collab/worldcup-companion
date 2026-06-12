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
    const data = await apiFetch<any>(`/competitions/${COMPETITION}/matches?status=IN_PLAY`);
    return (data.matches ?? []).map(normalizeFixture);
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
    const data = await apiFetch<any>(`/competitions/${COMPETITION}/matches?status=SCHEDULED`);
    return (data.matches ?? [])
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
  try {
    const data = await apiFetch<any>(`/matches/${fixtureId}`);
    const homeLineup: any[] = data.homeTeam?.lineup ?? [];
    const awayLineup: any[] = data.awayTeam?.lineup ?? [];
    if (homeLineup.length === 0 && awayLineup.length === 0) return null;
    return {
      home: buildTeamSheet(data.homeTeam),
      away: buildTeamSheet(data.awayTeam),
    };
  } catch { return null; }
}

function buildTeamSheet(team: any): TeamSheet {
  const lineup: any[] = team?.lineup ?? [];
  const bench: any[] = team?.bench ?? [];
  const formationStr: string = team?.formation ?? "";
  const lines = formationStr.split("-").map(Number).filter((n) => !isNaN(n) && n > 0);
  return {
    teamId: team?.id ?? 0,
    teamName: team?.name ?? "Unknown",
    teamCountry: team?.name ?? "Unknown",
    coach: team?.coach?.name ?? "Unknown",
    formation: { raw: formationStr, lines },
    starters: lineup.map((p: any) => normalizePlayer(p, team?.name ?? "")),
    subs: bench.map((p: any) => normalizePlayer(p, team?.name ?? "")),
    confirmed: lineup.length >= 11,
  };
}

function mapPosition(pos: string): string {
  const p = (pos ?? "").toUpperCase();
  if (p.includes("GOALKEEPER") || p === "G") return "G";
  if (p.includes("DEFENDER") || p === "D") return "D";
  if (p.includes("MIDFIELDER") || p === "M") return "M";
  if (p.includes("FORWARD") || p.includes("ATTACKER") || p === "F") return "F";
  return pos.charAt(0) || "?";
}

function normalizePlayer(p: any, teamName: string): Player {
  const clubLeagueCountry = p.currentTeam?.area?.name ?? "";
  return {
    id: p.id ?? 0,
    name: p.name ?? "Unknown",
    number: p.shirtNumber ?? 0,
    pos: mapPosition(p.position ?? ""),
    club: p.currentTeam?.name ?? "Unknown Club",
    clubLeague: p.currentTeam?.runningCompetition?.name ?? "",
    clubLeagueCountry,
    leagueTier: classifyLeagueTier(p.currentTeam?.runningCompetition?.name ?? "", clubLeagueCountry, teamName),
    bornAbroad: false,
    scoutNote: undefined,
  };
}

const TOP5_EU = ["Premier League", "La Liga", "Bundesliga", "Serie A", "Ligue 1"];
const OTHER_EU_COUNTRIES = ["Netherlands","Portugal","Belgium","Turkey","Scotland","Austria","Switzerland","Greece","Ukraine","Denmark","Sweden","Norway","Czech Republic","Croatia","Serbia","Poland","Romania","Hungary"];

export function classifyLeagueTier(leagueName: string, leagueCountry: string, teamCountry: string): import("@/types").LeagueTier {
  if (TOP5_EU.includes(leagueName)) return "top5eu";
  if (OTHER_EU_COUNTRIES.includes(leagueCountry)) return "otherEu";
  if (leagueCountry && teamCountry && leagueCountry.toLowerCase() === teamCountry.toLowerCase()) return "homeleague";
  return "minor";
}

export async function getMatchEvents(fixtureId: number): Promise<MatchEvent[]> {
  try {
    const data = await apiFetch<any>(`/matches/${fixtureId}`);
    const goals: MatchEvent[] = (data.goals ?? []).map((g: any) => ({
      minute: g.minute ?? 0, type: "Goal",
      playerOut: g.scorer?.name ?? "Unknown",
      detail: g.method ?? undefined,
    }));
    const subs: MatchEvent[] = (data.substitutions ?? []).map((s: any) => ({
      minute: s.minute ?? 0, type: "subst",
      playerIn: s.replacedBy?.name ?? "Unknown",
      playerOut: s.player?.name ?? "Unknown",
    }));
    const bookings: MatchEvent[] = (data.bookings ?? []).map((b: any) => ({
      minute: b.minute ?? 0, type: "Card",
      playerOut: b.player?.name ?? "Unknown",
      detail: b.card ?? undefined,
    }));
    return [...goals, ...subs, ...bookings].sort((a, b) => a.minute - b.minute);
  } catch { return []; }
}
