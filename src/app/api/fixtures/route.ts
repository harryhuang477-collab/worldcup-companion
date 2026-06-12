/**
 * GET /api/fixtures
 *
 * Returns live matches, today's fixtures, and next upcoming fixtures.
 * The client uses this to decide which match to open automatically.
 */

import { NextResponse } from "next/server";
import {
  getLiveFixtures,
  getTodayFixtures,
  getUpcomingFixtures,
} from "@/lib/football-api";
import { LIVE_STATUSES, UPCOMING_STATUSES } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [live, today, upcoming] = await Promise.allSettled([
      getLiveFixtures(),
      getTodayFixtures(),
      getUpcomingFixtures(),
    ]);

    const liveFixtures = live.status === "fulfilled" ? live.value : [];
    const todayFixtures = today.status === "fulfilled" ? today.value : [];
    const upcomingFixtures = upcoming.status === "fulfilled" ? upcoming.value : [];

    // Merge today + upcoming, deduplicate by id
    const allNonLive = [...todayFixtures, ...upcomingFixtures];
    const seen = new Set<number>();
    const deduped = allNonLive.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

    // Sort upcoming by kickoff ascending
    const upcoming2 = deduped
      .filter((f) => UPCOMING_STATUSES.includes(f.status as any))
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    return NextResponse.json({
      live: liveFixtures,
      today: deduped,
      nextUpcoming: upcoming2[0] ?? null,
    });
  } catch (err: any) {
    console.error("[/api/fixtures]", err);
    return NextResponse.json(
      { error: err.message ?? "Failed to fetch fixtures" },
      { status: 500 }
    );
  }
}
