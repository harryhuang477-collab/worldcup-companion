/**
 * GET /api/lineup?fixtureId=12345
 *
 * Returns confirmed lineups + formations for both teams.
 * Returns { confirmed: false } when the team sheet isn't out yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { getLineups } from "@/lib/football-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const fixtureId = Number(req.nextUrl.searchParams.get("fixtureId"));
  if (!fixtureId || isNaN(fixtureId)) {
    return NextResponse.json({ error: "fixtureId is required" }, { status: 400 });
  }

  try {
    const lineups = await getLineups(fixtureId);

    if (!lineups) {
      return NextResponse.json({ confirmed: false, home: null, away: null });
    }

    // Return data even if partial (TheSportsDB may only have some players)
    const hasData = (lineups.home?.starters?.length ?? 0) > 0 || (lineups.away?.starters?.length ?? 0) > 0;
    return NextResponse.json({
      confirmed: hasData,
      home: lineups.home,
      away: lineups.away,
    });
  } catch (err: any) {
    console.error("[/api/lineup]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch lineups" },
      { status: 500 }
    );
  }
}
