import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@wine-club/lib";

/**
 * GET /api/admin/test-clocks/[id]
 * Get a single test clock with details
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const testClock = await stripe.testHelpers.testClocks.retrieve(id);

    return NextResponse.json({
      id: testClock.id,
      name: testClock.name,
      frozenTime: testClock.frozen_time,
      status: testClock.status,
      created: testClock.created,
    });
  } catch (error: any) {
    console.error("[Test Clocks] Retrieve error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve test clock", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/test-clocks/[id]
 * Delete a test clock
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await stripe.testHelpers.testClocks.del(id);

    return NextResponse.json({ success: true, deleted: id });
  } catch (error: any) {
    console.error("[Test Clocks] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete test clock", details: error.message },
      { status: 500 }
    );
  }
}
