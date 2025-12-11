import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@wine-club/lib";

/**
 * GET /api/admin/test-clocks
 * List all test clocks
 */
export async function GET() {
  try {
    const testClocks = await stripe.testHelpers.testClocks.list({
      limit: 20,
    });

    return NextResponse.json({
      testClocks: testClocks.data.map((clock) => ({
        id: clock.id,
        name: clock.name,
        frozenTime: clock.frozen_time,
        status: clock.status,
        created: clock.created,
      })),
    });
  } catch (error: any) {
    console.error("[Test Clocks] List error:", error);
    return NextResponse.json(
      { error: "Failed to list test clocks", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/test-clocks
 * Create a new test clock
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, frozenTime } = body;

    // Default to current time if not specified
    const frozen_time = frozenTime
      ? Math.floor(new Date(frozenTime).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const testClock = await stripe.testHelpers.testClocks.create({
      frozen_time,
      name: name || `Test Clock ${new Date().toISOString()}`,
    });

    return NextResponse.json({
      id: testClock.id,
      name: testClock.name,
      frozenTime: testClock.frozen_time,
      status: testClock.status,
      created: testClock.created,
    });
  } catch (error: any) {
    console.error("[Test Clocks] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create test clock", details: error.message },
      { status: 500 }
    );
  }
}
