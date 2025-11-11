import { NextRequest, NextResponse } from "next/server";
import { decodeConsumerSession } from "@/lib/consumer-auth";

export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("consumer_session");

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const session = decodeConsumerSession(sessionCookie.value);

    if (!session) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      consumerId: session.consumerId,
      email: session.email,
      name: session.name,
      businessSlug: session.businessSlug,
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json(
      { error: "Session check failed" },
      { status: 500 }
    );
  }
}

