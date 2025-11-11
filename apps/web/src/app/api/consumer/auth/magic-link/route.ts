import { NextRequest, NextResponse } from "next/server";
import { sendConsumerMagicLink } from "@/lib/consumer-auth";
import { z } from "zod";

const magicLinkSchema = z.object({
  email: z.string().email(),
  businessSlug: z.string().min(1),
  returnUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, businessSlug, returnUrl } = magicLinkSchema.parse(body);

    const success = await sendConsumerMagicLink(email, businessSlug, returnUrl);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to send magic link" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Magic link error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to send magic link" },
      { status: 500 }
    );
  }
}

