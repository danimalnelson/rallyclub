import { NextRequest, NextResponse } from "next/server";
import { verifyMagicToken, encodeConsumerSession } from "@/lib/consumer-auth";
import { z } from "zod";

const verifySchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  businessSlug: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email, businessSlug } = verifySchema.parse(body);

    // Verify the magic token
    const consumer = await verifyMagicToken(token, email);

    if (!consumer) {
      return NextResponse.json(
        { error: "Invalid or expired link" },
        { status: 400 }
      );
    }

    // Create consumer session
    const session = encodeConsumerSession({
      consumerId: consumer.id,
      email: consumer.email,
      name: consumer.name,
      businessSlug,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Set session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("consumer_session", session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Verify error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}

