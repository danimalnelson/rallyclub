import { NextResponse } from "next/server";

/**
 * Version endpoint - NO IMPORTS
 * Shows what commit is deployed
 */
export async function GET() {
  return NextResponse.json({
    commit: "e0eb7eb",
    message: "Upstash fully removed",
    timestamp: new Date().toISOString(),
  });
}


