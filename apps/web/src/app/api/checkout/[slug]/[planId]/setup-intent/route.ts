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

    // Find or create customer
    let stripeCustomerId: string;
    
    const existingConsumer = await prisma.consumer.findUnique({
      where: { email: consumerEmail },
      include: {
        planSubscriptions: {
          take: 1,
          select: { stripeCustomerId: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Check if consumer already has a Stripe customer ID from a previous subscription
    if (existingConsumer?.planSubscriptions[0]?.stripeCustomerId) {
      stripeCustomerId = existingConsumer.planSubscriptions[0].stripeCustomerId;
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: consumerEmail,
        metadata: {
          businessId: business.id,
          businessSlug: slug,
        },
      });
      stripeCustomerId = customer.id;
    }

    // Create SetupIntent for saving payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
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

