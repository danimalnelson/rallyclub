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
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
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

    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: "Plan price not configured" },
        { status: 500 }
      );
    }

    // Create Stripe Checkout Session
    const stripe = getStripeClient(business.stripeAccountId);

    const successUrl = `${process.env.PUBLIC_APP_URL}/${slug}/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.PUBLIC_APP_URL}/${slug}/plans/${plan.id}`;

    const sessionParams: any = {
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        planId: plan.id,
        planName: plan.name,
        membershipId: plan.membershipId,
        businessId: business.id,
        businessSlug: slug,
      },
      subscription_data: {
        metadata: {
          planId: plan.id,
          membershipId: plan.membershipId,
          businessId: business.id,
        },
      },
    };

    // Add trial period if configured
    if (plan.trialPeriodDays && plan.trialPeriodDays > 0) {
      sessionParams.subscription_data.trial_period_days = plan.trialPeriodDays;
    }

    // Add setup fee if configured
    if (plan.setupFee && plan.setupFee > 0) {
      // For setup fees, we need to create a one-time payment item
      // This requires creating a one-time price for the setup fee
      // For now, we'll document this as a TODO
      // TODO: Implement setup fee as additional line item with mode: "payment" + subscription
      console.warn(`Setup fee of ${plan.setupFee} for plan ${plan.id} not yet implemented in checkout`);
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error("Checkout session creation error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error.message },
      { status: 500 }
    );
  }
}

