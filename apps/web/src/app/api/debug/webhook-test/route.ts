import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET() {
  try {
    // Get recent webhook events
    const recentWebhooks = await prisma.webhookEvent.findMany({
      orderBy: {
        id: "desc",
      },
      take: 20,
      select: {
        id: true,
        type: true,
        processed: true,
        signatureValid: true,
        processingError: true,
        accountId: true,
      },
    });

    // Get webhook secret from env
    const webhookSecretConfigured = !!process.env.STRIPE_WEBHOOK_SECRET;
    const webhookSecretValue = process.env.STRIPE_WEBHOOK_SECRET 
      ? `${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10)}...` 
      : "NOT SET";

    // Count subscriptions
    const planSubscriptionCount = await prisma.planSubscription.count();
    const oldSubscriptionCount = await prisma.subscription.count();

    return NextResponse.json({
      environment: {
        webhookSecretConfigured,
        webhookSecretPreview: webhookSecretValue,
        nodeEnv: process.env.NODE_ENV,
        publicAppUrl: process.env.PUBLIC_APP_URL,
      },
      statistics: {
        planSubscriptions: planSubscriptionCount,
        oldSubscriptions: oldSubscriptionCount,
        totalWebhookEvents: recentWebhooks.length,
      },
      recentWebhooks: recentWebhooks.map(wh => ({
        id: wh.id,
        type: wh.type,
        processed: wh.processed,
        signatureValid: wh.signatureValid,
        error: wh.processingError,
        accountId: wh.accountId,
      })),
      help: {
        message: "If webhookSecretConfigured is false, add STRIPE_WEBHOOK_SECRET to Vercel env vars",
        stripeWebhookUrl: "https://dashboard.stripe.com/test/webhooks",
        vercelEnvVars: "https://vercel.com/dannelson/membership-saas/settings/environment-variables",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to check webhook status", details: error.message },
      { status: 500 }
    );
  }
}

