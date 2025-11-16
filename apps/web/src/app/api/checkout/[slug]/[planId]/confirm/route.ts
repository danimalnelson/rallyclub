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
    const { setupIntentId, paymentMethodId, consumerEmail, consumerName } = body;

    if (!setupIntentId || !paymentMethodId || !consumerEmail) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: "Plan price not configured" },
        { status: 500 }
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

    // Verify setup intent
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
    
    if (setupIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Setup intent not completed" },
        { status: 400 }
      );
    }

    const customerId = setupIntent.customer as string;

    // Create or update consumer record
    let consumer = await prisma.consumer.findUnique({
      where: { email: consumerEmail },
    });

    if (!consumer) {
      consumer = await prisma.consumer.create({
        data: {
          email: consumerEmail,
          name: consumerName || null,
          businessId: business.id,
        },
      });
    } else if (consumerName && !consumer.name) {
      // Update consumer name if provided and not already set
      consumer = await prisma.consumer.update({
        where: { id: consumer.id },
        data: {
          name: consumerName,
        },
      });
    }

    // Check for existing active subscription to this plan
    const existingSubscription = await prisma.planSubscription.findFirst({
      where: {
        consumerId: consumer.id,
        planId: plan.id,
        status: {
          in: ["active", "trialing", "paused"],
        },
      },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { error: "You already have an active subscription to this plan" },
        { status: 400 }
      );
    }

    // Create Stripe subscription
    const subscriptionParams: any = {
      customer: customerId,
      items: [
        {
          price: plan.stripePriceId,
        },
      ],
      default_payment_method: paymentMethodId,
      metadata: {
        planId: plan.id,
        planName: plan.name,
        membershipId: plan.membershipId,
        businessId: business.id,
        consumerId: consumer.id,
      },
      expand: ["latest_invoice.payment_intent"],
    };

    // Handle billing anchor
    if (plan.membership.billingAnchor === "NEXT_INTERVAL" && plan.membership.cohortBillingDay) {
      subscriptionParams.billing_cycle_anchor_config = {
        day_of_month: plan.membership.cohortBillingDay,
      };
      subscriptionParams.proration_behavior = "none";
    }

    console.log("[Subscription] Creating with params:", {
      customer: customerId,
      priceId: plan.stripePriceId,
      metadata: subscriptionParams.metadata,
    });

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // Create PlanSubscription record
    const planSubscription = await prisma.planSubscription.create({
      data: {
        consumerId: consumer.id,
        planId: plan.id,
        businessId: business.id,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerId,
        status: subscription.status.toUpperCase(),
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        lastSyncedAt: new Date(),
      },
    });

    console.log("[Subscription] Created successfully:", {
      subscriptionId: subscription.id,
      planSubscriptionId: planSubscription.id,
      status: subscription.status,
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      planSubscriptionId: planSubscription.id,
      status: subscription.status,
    });
  } catch (error: any) {
    console.error("Subscription creation error:", error);
    return NextResponse.json(
      { error: "Failed to create subscription", details: error.message },
      { status: 500 }
    );
  }
}

