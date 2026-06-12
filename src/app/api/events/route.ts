/**
 * GET /api/events?fixtureId=12345
 *
 * Returns match events (goals, cards, substitutions) for a live match.
 * Also returns current fixture status so the client can decide polling cadence.
 */

import { NextRequest, NextResponse } from "next/server";
import { getMatchEvents, getFixtureById } from "@/lib/football-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));
  if (!fixtureId || isNaN(fixtureId)) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  try {
    const [events, fixture] = await Promise.all([
      getMatchEvents(fixtureId),
      getFixtureById(fixtureId),
    ]);

    return NextResponse.json({
      events,
      status: fixture?.status ?? null,
      minute: fixture?.minute ?? null,
      homeScore: fixture?.homeScore ?? null,
      awayScore: fixture?.awayScore ?? null,
    });
  } catch (err: any) {
    console.error("[/api/events]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch events" },
      { status: 500 }
    );
  }
}
