import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string; planId: string }> }
) {
  try {
    const { slug, planId } = await context.params;
    const body = await req.json();
    const { consumerEmail } = body;

    if (!consumerEmail) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find plan and verify it's active
    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        status: "ACTIVE",
        membership: {
          status: "ACTIVE",
          business: {
            slug,
          },
        },
      },
      include: {
        membership: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found or unavailable" },
        { status: 404 }
      );
    }

    // Check stock status
    if (plan.stockStatus === "SOLD_OUT" || plan.stockStatus === "COMING_SOON") {
      return NextResponse.json(
        { error: `This plan is ${plan.stockStatus.toLowerCase().replace("_", " ")}` },
        { status: 400 }
      );
    }

    const business = plan.membership.business;

    if (!business.stripeAccountId) {
      return NextResponse.json(
        { error: "Business Stripe account not connected" },
        { status: 500 }
      );
    }

    // Get Stripe client for connected account
    const stripe = getStripeClient(business.stripeAccountId);

    // Check if consumer already exists with a Stripe customer ID
    // Only reuse customer if they have a previous successful subscription
    let stripeCustomerId: string | undefined;
    
    const existingConsumer = await prisma.consumer.findUnique({
      where: { email: consumerEmail },
      include: {
        planSubscriptions: {
          where: {
            NOT: {
              stripeCustomerId: null,
            },
          },
          take: 1,
          select: { stripeCustomerId: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Reuse existing customer ID only if they have a previous subscription
    if (existingConsumer?.planSubscriptions[0]?.stripeCustomerId) {
      stripeCustomerId = existingConsumer.planSubscriptions[0].stripeCustomerId;
      console.log("[Setup Intent] Reusing existing customer:", stripeCustomerId);
    } else {
      console.log("[Setup Intent] New customer - will create on successful payment");
    }

    // Create SetupIntent WITHOUT customer for new users
    // Customer will be created in /confirm endpoint after payment succeeds
    const setupIntent = await stripe.setupIntents.create({
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        planId: plan.id,
        planName: plan.name,
        membershipId: plan.membershipId,
        businessId: business.id,
        businessSlug: slug,
        consumerEmail: consumerEmail,
      },
    });

    console.log("[Setup Intent] Created:", {
      id: setupIntent.id,
      customer: stripeCustomerId,
      planId: plan.id,
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error: any) {
    console.error("Setup intent creation error:", error);
    return NextResponse.json(
      { error: "Failed to create setup intent", details: error.message },
      { status: 500 }
    );
  }
}

