import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@wine-club/lib";

/**
 * POST /api/admin/test-clocks/[id]/advance
 * Advance a test clock to a specific time
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { frozenTime, advanceBy } = body;

    // Get current clock state, with retry if advancing
    let currentClock = await stripe.testHelpers.testClocks.retrieve(id);
    
    // If clock is advancing, wait and retry a few times
    let retries = 0;
    while (currentClock.status === "advancing" && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      currentClock = await stripe.testHelpers.testClocks.retrieve(id);
      retries++;
    }
    
    if (currentClock.status === "advancing") {
      return NextResponse.json(
        { error: "Test clock is still advancing after waiting. Please try again in a few seconds." },
        { status: 400 }
      );
    }
    
    let newFrozenTime: number;

    if (frozenTime) {
      // Advance to specific time
      newFrozenTime = Math.floor(new Date(frozenTime).getTime() / 1000);
    } else if (advanceBy) {
      // Advance by duration (in seconds)
      newFrozenTime = currentClock.frozen_time + advanceBy;
    } else {
      return NextResponse.json(
        { error: "Must provide either frozenTime or advanceBy" },
        { status: 400 }
      );
    }

    // Ensure we're advancing forward
    if (newFrozenTime <= currentClock.frozen_time) {
      return NextResponse.json(
        { error: "Can only advance time forward, not backward" },
        { status: 400 }
      );
    }

    const testClock = await stripe.testHelpers.testClocks.advance(id, {
      frozen_time: newFrozenTime,
    });

    return NextResponse.json({
      id: testClock.id,
      name: testClock.name,
      frozenTime: testClock.frozen_time,
      previousFrozenTime: currentClock.frozen_time,
      status: testClock.status,
      advancedBy: testClock.frozen_time - currentClock.frozen_time,
    });
  } catch (error: any) {
    console.error("[Test Clocks] Advance error:", error.message);
    return NextResponse.json(
      { error: "Failed to advance test clock", details: error.message },
      { status: 500 }
    );
  }
}
