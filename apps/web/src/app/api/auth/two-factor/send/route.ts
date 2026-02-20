import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@wine-club/db";
import { createHash, randomInt } from "crypto";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const CODE_EXPIRY_MINUTES = 10;
const MAX_CODES_PER_HOUR = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * POST /api/auth/two-factor/send
 * Generates a 6-digit code, stores the hash, emails the plaintext.
 * Requires an active (but possibly unverified) JWT session.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  if (!token?.sub || !token?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = token.sub;
  const email = token.email;

  const isDev = process.env.NODE_ENV === "development";

  try {
    // Rate limit: max codes per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.twoFactorCode.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= MAX_CODES_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many verification codes requested. Please wait before trying again." },
        { status: 429 }
      );
    }

    // Invalidate any existing unused codes for this user
    await prisma.twoFactorCode.updateMany({
      where: { userId, used: false },
      data: { used: true },
    });

    // Generate a 6-digit code
    const code = randomInt(100000, 999999).toString();
    const hashedCode = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    await prisma.twoFactorCode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt,
      },
    });

    // Always log code in development so it's accessible from the terminal
    if (isDev) {
      console.log(`[2FA] Code for ${email}: ${code}`);
    }

    if (!resend) {
      return NextResponse.json({ success: true });
    }

    const fromEmail = process.env.EMAIL_FROM || "onboarding@resend.dev";

    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your Vintigo verification code",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Verification Code</h2>
          <p>Enter this code to complete your sign-in:</p>
          <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">This code expires in ${CODE_EXPIRY_MINUTES} minutes. If you didn't request this, you can safely ignore it.</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("[2FA] Failed to send code email:", result.error.message);
      if (!isDev) {
        return NextResponse.json(
          { error: "Failed to send verification code" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[2FA_SEND_ERROR]", error);
    if (!isDev) {
      return NextResponse.json(
        { error: "Failed to send verification code" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  }
}
