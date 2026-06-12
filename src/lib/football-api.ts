/**
 * API-Football (api-sports.io) wrapper.
 * All calls go through this file — keys stay server-side only.
 *
 * 2026 World Cup: league=1, season=2026
 */

import type { Fixture, FixtureStatus, TeamSheet, MatchEvent, Player, Formation } from "@/types";

const BASE = "https://v3.football.api-sports.io";
const LEAGUE = 1;    // FIFA World Cup
const SEASON = 2026;

function headers() {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("FOOTBALL_API_KEY is not set");
  return { "x-apisports-key": key };
}

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: headers(), next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`API-Football error ${res.status}: ${url}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football errors: ${JSON.stringify(json.errors)}`);
  }
  return json.response as T;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

export async function getLiveFixtures(): Promise<Fixture[]> {
  // Returns all currently live World Cup matches
  const data = await apiFetch<any[]>(
    `/fixtures?league=${LEAGUE}&season=${SEASON}&live=all`
  );
  return data.map(normalizeFixture);
}

export async function getTodayFixtures(): Promise<Fixture[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const data = await apiFetch<any[]>(
    `/fixtures?league=${LEAGUE}&season=${SEASON}&date=${today}`
  );
  return data.map(normalizeFixture);
}

export async function getUpcomingFixtures(): Promise<Fixture[]> {
  // Next 3 days
  const data = await apiFetch<any[]>(
    `/fixtures?league=${LEAGUE}&season=${SEASON}&status=NS&next=10`
  );
  return data.map(normalizeFixture);
}

export async function getFixtureById(id: number): Promise<Fixture | null> {
  const data = await apiFetch<any[]>(`/fixtures?id=${id}`);
  return data.length > 0 ? normalizeFixture(data[0]) : null;
}

function normalizeFixture(f: any): Fixture {
  return {
    id: f.fixture.id,
    homeTeam: f.teams.home.name,
    homeTeamId: f.teams.home.id,
    awayTeam: f.teams.away.name,
    awayTeamId: f.teams.away.id,
    kickoff: f.fixture.date,
    status: f.fixture.status.short as FixtureStatus,
    minute: f.fixture.status.elapsed ?? null,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    round: f.league.round ?? "",
    venue: f.fixture.venue?.name ?? "",
  };
}

// ─── Lineups ───────────────────────────────────────────────────────────────

export async function getLineups(fixtureId: number): Promise<{ home: TeamSheet; away: TeamSheet } | null> {
  const data = await apiFetch<any[]>(`/fixtures/lineups?fixture=${fixtureId}`);
  if (!data || data.length < 2) return null;

  const [homeRaw, awayRaw] = data;
  return {
    home: normalizeTeamSheet(homeRaw),
    away: normalizeTeamSheet(awayRaw),
  };
}

function normalizeTeamSheet(t: any): TeamSheet {
  const starters: Player[] = (t.startXI ?? []).map((entry: any) =>
    normalizePlayer(entry.player, t.team)
  );
  const subs: Player[] = (t.substitutes ?? []).map((entry: any) =>
    normalizePlayer(entry.player, t.team)
  );

  const formationStr: string = t.formation ?? "";
  const lines = formationStr.split("-").map(Number).filter((n) => !isNaN(n));

  return {
    teamId: t.team.id,
    teamName: t.team.name,
    teamCountry: t.team.name, // API uses team name; country is same for national teams
    coach: t.coach?.name ?? "Unknown",
    formation: { raw: formationStr, lines },
    starters,
    subs,
    confirmed: starters.length === 11,
  };
}

function normalizePlayer(p: any, team: any): Player {
  const clubLeague: string = p.league ?? "";
  const clubLeagueCountry: string = p.leagueCountry ?? "";

  return {
    id: p.id,
    name: p.name,
    number: p.number ?? 0,
    pos: p.pos ?? "?",
    club: p.team ?? "Unknown Club",
    clubLeague,
    clubLeagueCountry,
    leagueTier: classifyLeagueTier(clubLeague, clubLeagueCountry, team.name),
    bornAbroad: false, // enriched by events endpoint if available; default false
    scoutNote: undefined,
  };
}

// ─── League tier classification ────────────────────────────────────────────

const TOP5_EU_LEAGUES = new Set([
  "Premier League",
  "La Liga",
  "Bundesliga",
  "Serie A",
  "Ligue 1",
  "Championship", // second-tier EN counts as other EU
]);

const TOP5_EU_COUNTRIES = new Set(["England", "Spain", "Germany", "Italy", "France"]);

// Broader "other European" leagues
const OTHER_EU_COUNTRIES = new Set([
  "Netherlands", "Portugal", "Belgium", "Turkey", "Russia",
  "Scotland", "Austria", "Switzerland", "Greece", "Ukraine",
  "Denmark", "Sweden", "Norway", "Czech Republic", "Croatia",
  "Serbia", "Poland", "Romania", "Hungary",
]);

export function classifyLeagueTier(
  leagueName: string,
  leagueCountry: string,
  teamCountry: string
): import("@/types").LeagueTier {
  // Top 5 EU: must be one of the actual top leagues
  if (
    TOP5_EU_COUNTRIES.has(leagueCountry) &&
    (TOP5_EU_LEAGUES.has(leagueName) || leagueName.includes("Premier") || leagueName.includes("Liga"))
  ) {
    // But not the lower tiers (Championship, League One, etc.)
    if (
      leagueName === "Premier League" ||
      leagueName === "La Liga" ||
      leagueName === "Bundesliga" ||
      leagueName === "Serie A" ||
      leagueName === "Ligue 1"
    ) {
      return "top5eu";
    }
  }
  if (OTHER_EU_COUNTRIES.has(leagueCountry) || TOP5_EU_COUNTRIES.has(leagueCountry)) {
    return "otherEu";
  }
  // Home league: league country matches team country (national team)
  if (leagueCountry && teamCountry && leagueCountry.toLowerCase() === teamCountry.toLowerCase()) {
    return "homeleague";
  }
  // Everything else
  return "minor";
}

// ─── Match events (for subs) ───────────────────────────────────────────────

export async function getMatchEvents(fixtureId: number): Promise<MatchEvent[]> {
  const data = await apiFetch<any[]>(`/fixtures/events?fixture=${fixtureId}`);
  return (data ?? []).map((e: any) => ({
    minute: e.time?.elapsed ?? 0,
    type: e.type ?? "",
    playerIn: e.assist?.name ?? undefined,
    playerOut: e.player?.name ?? undefined,
    detail: e.detail ?? undefined,
  }));
}
