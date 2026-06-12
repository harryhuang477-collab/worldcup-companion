import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const fixtureId = 537333;
  const key = process.env.FOOTBALL_API_KEY;

  const fdRes = await fetch(`https://api.football-data.org/v4/matches/${fixtureId}`, {
    headers: { "X-Auth-Token": key! }, cache: "no-store"
  });
  const fdMatch = await fdRes.json();

  const homeLineup = fdMatch?.homeTeam?.lineup ?? [];
  const awayLineup = fdMatch?.awayTeam?.lineup ?? [];

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    matchStatus: fdMatch?.status,
    minute: fdMatch?.minute,
    homeTeam: fdMatch?.homeTeam?.name,
    homeFormation: fdMatch?.homeTeam?.formation,
    homeLineupCount: homeLineup.length,
    homeLineupSample: homeLineup.slice(0, 3),
    awayLineupCount: awayLineup.length,
    // Show all keys in homeTeam to see what the API actually returns
    homeTeamKeys: Object.keys(fdMatch?.homeTeam ?? {}),
    rawHomeTeam: fdMatch?.homeTeam,
  });
}
