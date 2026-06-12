/**
 * GET /api/debug
 * Diagnostic endpoint — shows raw API-Football responses.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function apiFetch(path: string) {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return { error: "FOOTBALL_API_KEY not set" };
  const url = `https://v3.football.api-sports.io${path}`;
  try {
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });
    const json = await res.json();
    return { url, status: res.status, results: json.results, errors: json.errors, response: json.response?.slice(0, 3) };
  } catch (e: any) {
    return { url, error: e.message };
  }
}

export async function GET() {
  const key = process.env.FOOTBALL_API_KEY;
  const today = new Date().toISOString().slice(0, 10);

  const [
    apiStatus,
    worldCupLeague,
    next10,
    todayFixtures,
    liveFixtures,
    searchWorldCup,
  ] = await Promise.all([
    apiFetch("/status"),
    apiFetch("/leagues?id=1&season=2026"),
    apiFetch("/fixtures?league=1&season=2026&next=10"),
    apiFetch(`/fixtures?league=1&season=2026&date=${today}`),
    apiFetch("/fixtures?league=1&season=2026&live=all"),
    apiFetch("/leagues?name=FIFA World Cup&season=2026"),
  ]);

  return NextResponse.json({
    keyPresent: !!key,
    keyPrefix: key ? key.slice(0, 6) + "..." : null,
    serverTime: new Date().toISOString(),
    serverDate: today,
    apiStatus,
    worldCupLeague,
    next10,
    todayFixtures,
    liveFixtures,
    searchWorldCup,
  }, { status: 200 });
}
