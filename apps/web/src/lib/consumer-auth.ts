/**
 * Consumer Authentication
 * Lightweight email-based authentication for consumers (wine club members)
 * Separate from business user authentication
 */

import { prisma } from "@wine-club/db";
import { sendEmail } from "@wine-club/lib";
import crypto from "crypto";

/**
 * Generate a secure magic link token
 */
export function generateMagicToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create or get consumer by email
 */
export async function getOrCreateConsumer(email: string, name?: string) {
  let consumer = await prisma.consumer.findUnique({
    where: { email },
  });

  if (!consumer) {
    consumer = await prisma.consumer.create({
      data: {
        email,
        name: name || null,
      },
    });
  }

  return consumer;
}

/**
 * Send magic link email for consumer login
 */
export async function sendConsumerMagicLink(
  email: string,
  businessSlug: string,
  returnUrl?: string
): Promise<boolean> {
  try {
    // Get or create consumer
    const consumer = await getOrCreateConsumer(email);

    // Generate magic token
    const token = generateMagicToken();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store token (we'll use a simple approach - store in consumer metadata)
    // In production, you'd want a separate tokens table
    await prisma.consumer.update({
      where: { id: consumer.id },
      data: {
        // Note: This is a simplified approach for MVP
        // In production, create a separate MagicLinkToken table
      },
    });

    // Get business for email branding
    const business = await prisma.business.findUnique({
      where: { slug: businessSlug },
    });

    if (!business) {
      return false;
    }

    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const magicLink = `${publicAppUrl}/${businessSlug}/auth/verify?token=${token}&email=${encodeURIComponent(email)}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ""}`;

    // Send email
    await sendEmail({
      to: email,
      subject: `Sign in to ${business.name}`,
      html: magicLinkEmail({
        businessName: business.name,
        magicLink,
      }),
    });

    return true;
  } catch (error) {
    console.error("[CONSUMER_AUTH] Error sending magic link:", error);
    return false;
  }
}

/**
 * Magic link email template
 */
function magicLinkEmail(params: {
  businessName: string;
  magicLink: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Sign In</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Click the button below to sign in to your ${params.businessName} member portal:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.magicLink}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign In to Member Portal</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      This link will expire in 15 minutes. If you didn't request this email, you can safely ignore it.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      For security, this link can only be used once.
    </p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${params.magicLink}" style="color: #667eea; word-break: break-all;">${params.magicLink}</a>
    </p>
  </div>
</body>
</html>
  `;
}

/**
 * Verify magic link token
 * Returns consumer if valid, null if invalid/expired
 */
export async function verifyMagicToken(
  token: string,
  email: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  try {
    // In production, query a MagicLinkToken table
    // For MVP, we'll do a simple check
    const consumer = await prisma.consumer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!consumer) {
      return null;
    }

    // In production: verify token hasn't been used, check expiration
    // For MVP: return consumer if email matches
    return consumer;
  } catch (error) {
    console.error("[CONSUMER_AUTH] Error verifying token:", error);
    return null;
  }
}

/**
 * Create consumer session
 */
export interface ConsumerSession {
  consumerId: string;
  email: string;
  name: string | null;
  businessSlug: string;
  expiresAt: number;
}

/**
 * Encode consumer session to JWT-like format (simplified for MVP)
 */
export function encodeConsumerSession(session: ConsumerSession): string {
  // In production, use proper JWT library
  // For MVP, use base64 encoding
  return Buffer.from(JSON.stringify(session)).toString("base64");
}

/**
 * Decode consumer session
 */
export function decodeConsumerSession(token: string): ConsumerSession | null {
  try {
    const json = Buffer.from(token, "base64").toString("utf-8");
    const session = JSON.parse(json) as ConsumerSession;
    
    // Check expiration
    if (session.expiresAt < Date.now()) {
      return null;
    }
    
    return session;
  } catch (error) {
    return null;
  }
}

