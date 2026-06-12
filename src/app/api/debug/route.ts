/**
 * GET /api/debug
 * Diagnostic endpoint — shows raw API-Football responses.
 * Remove this file after debugging.
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
      next: { revalidate: 0 },
    });
    const json = await res.json();
    return { url, status: res.status, results: json.results, errors: json.errors, sample: json.response?.slice(0, 2) };
  } catch (e: any) {
    return { url, error: e.message };
  }
}

export async function GET() {
  const key = process.env.FOOTBALL_API_KEY;

  const [next10, today, live, status] = await Promise.all([
    apiFetch("/fixtures?league=1&season=2026&next=10"),
    apiFetch(`/fixtures?league=1&season=2026&date=${new Date().toISOString().slice(0, 10)}`),
    apiFetch("/fixtures?league=1&season=2026&live=all"),
    apiFetch("/status"),
  ]);

  return NextResponse.json({
    keyPresent: !!key,
    keyPrefix: key ? key.slice(0, 6) + "..." : null,
    serverTime: new Date().toISOString(),
    next10,
    today,
    live,
    apiStatus: status,
  });
}
