import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function GET() {
  const fixtureId = 537333;

  // Step 1: Get match from football-data.org
  const key = process.env.FOOTBALL_API_KEY;
  const fdRes = await fetch(`https://api.football-data.org/v4/matches/${fixtureId}`, {
    headers: { "X-Auth-Token": key! }, cache: "no-store"
  });
  const fdMatch = await fdRes.json();

  const kickoffDate = fdMatch?.utcDate?.slice(0, 10);
  const kickoffTs = new Date(fdMatch?.utcDate).getTime();

  // Step 2: Get TheSportsDB events
  const tsdbRes = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=${kickoffDate}&l=4429`, { cache: "no-store" });
  const tsdbData = await tsdbRes.json();
  const events = tsdbData.events ?? [];

  // Step 3: Find matching event
  const tsdbEvent = events.find((e: any) => {
    const diff = Math.abs(new Date(e.strTimestamp).getTime() - kickoffTs);
    return diff < 5 * 60 * 1000;
  });

  // Step 4: Get lineup
  let lineup = null;
  if (tsdbEvent) {
    const lRes = await fetch(`https://www.thesportsdb.com/api/v1/json/123/lookuplineup.php?id=${tsdbEvent.idEvent}`, { cache: "no-store" });
    lineup = await lRes.json();
  }

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    fdMatchStatus: fdMatch?.status,
    kickoffDate,
    kickoffTs,
    homeTeam: fdMatch?.homeTeam?.name,
    tsdbEventsFound: events.length,
    tsdbEventMatched: tsdbEvent ? { id: tsdbEvent.idEvent, home: tsdbEvent.strHomeTeam, kickoff: tsdbEvent.strTimestamp } : null,
    lineupCount: lineup?.lineup?.length ?? 0,
    lineupSample: lineup?.lineup?.slice(0, 3) ?? [],
  });
}
