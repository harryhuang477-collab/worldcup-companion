import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const fixtureId = 537333;
  const key = process.env.FOOTBALL_API_KEY;

  // Check football-data.org lineup directly
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
    score: fdMatch?.score?.fullTime,
    homeTeam: fdMatch?.homeTeam?.name,
    homeFormation: fdMatch?.homeTeam?.formation,
    homeLineupCount: homeLineup.length,
    homeLineupSample: homeLineup.slice(0, 3).map((p: any) => ({ name: p.name, pos: p.position, shirt: p.shirtNumber })),
    awayTeam: fdMatch?.awayTeam?.name,
    awayFormation: fdMatch?.awayTeam?.formation,
    awayLineupCount: awayLineup.length,
    awayLineupSample: awayLineup.slice(0, 3).map((p: any) => ({ name: p.name, pos: p.position, shirt: p.shirtNumber })),
    rawSample: fdMatch?.homeTeam,
  });
}
