import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

async function apiFetch(path: string) {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) return { error: "FOOTBALL_API_KEY not set" };
  const url = `https://api.football-data.org/v4${path}`;
  try {
    const res = await fetch(url, { headers: { "X-Auth-Token": key }, cache: "no-store" });
    const json = await res.json();
    return { url, status: res.status, results: Array.isArray(json.matches) ? json.matches.length : json.count, sample: json.matches?.slice(0, 2) ?? json };
  } catch (e: any) {
    return { url, error: e.message };
  }
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const [live, todayF, upcoming] = await Promise.all([
    apiFetch("/competitions/WC/matches?status=IN_PLAY"),
    apiFetch(`/competitions/WC/matches?dateFrom=${today}&dateTo=${today}`),
    apiFetch("/competitions/WC/matches?status=SCHEDULED"),
  ]);
  return NextResponse.json({ serverTime: new Date().toISOString(), live, today: todayF, upcoming });
}
