// ─── Domain types ───────────────────────────────────────────────────────────

export type LeagueTier = "top5eu" | "otherEu" | "homeleague" | "minor";

export interface Player {
  id: number;
  name: string;
  number: number;
  pos: string; // G / D / M / F
  club: string;
  clubLeague: string;
  clubLeagueCountry: string;
  leagueTier: LeagueTier;
  bornAbroad: boolean; // nationality ≠ team country
  scoutNote?: string; // LLM-generated, cached
}

export interface Formation {
  raw: string; // e.g. "4-3-3"
  lines: number[]; // e.g. [4,3,3]
}

export interface TeamSheet {
  teamId: number;
  teamName: string;
  teamCountry: string;
  coach: string;
  formation: Formation;
  starters: Player[]; // 11
  subs: Player[];
  confirmed: boolean;
}

export interface MatchEvent {
  minute: number;
  type: string; // "subst" | "Goal" | "Card" | ...
  playerIn?: string;
  playerOut?: string;
  detail?: string;
}

export interface Fixture {
  id: number;
  homeTeam: string;
  homeTeamId: number;
  awayTeam: string;
  awayTeamId: number;
  kickoff: string; // ISO
  status: FixtureStatus;
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  round: string;
  venue: string;
}

export type FixtureStatus =
  | "NS"   // not started
  | "1H"   // first half
  | "HT"   // halftime
  | "2H"   // second half
  | "ET"   // extra time
  | "BT"   // break in ET
  | "P"    // penalties
  | "FT"   // full time
  | "AET"  // after ET
  | "PEN"  // after penalties
  | "SUSP" | "INT" | "PST" | "CANC" | "ABD" | "AWD" | "WO" | "LIVE";

export const LIVE_STATUSES: FixtureStatus[] = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE"];
export const UPCOMING_STATUSES: FixtureStatus[] = ["NS"];
export const FINISHED_STATUSES: FixtureStatus[] = ["FT", "AET", "PEN", "AWD", "WO"];

export interface TacticsNote {
  plan: string;
  strength: string;
  weakness: string;
  keyBattle: string;
  whyWatch: string; // "why watch this underdog" — shown once per match
}
