import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string; planId: string }> }
) {
  try {
    const { slug, planId } = await context.params;
    
    // Email is optional now - Stripe Checkout will collect it
    // This eliminates the redundant email collection step
    const body = await req.json();
    const { email } = body;

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
      // Only pre-fill email if provided (optional now - Stripe will collect it)
      ...(email && { customer_email: email }),
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Collect customer name and billing address
      billing_address_collection: "required",
      phone_number_collection: {
        enabled: true,
      },
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

    // Add setup fee if configured
    if (plan.setupFee && plan.setupFee > 0) {
      // For setup fees, we need to create a one-time payment item
      // This requires creating a one-time price for the setup fee
      // For now, we'll document this as a TODO
      // TODO: Implement setup fee as additional line item with mode: "payment" + subscription
      console.warn(`Setup fee of ${plan.setupFee} for plan ${plan.id} not yet implemented in checkout`);
    }

    console.log("[Checkout] Creating session with params:", {
      mode: sessionParams.mode,
      priceId: sessionParams.line_items[0].price,
      metadata: sessionParams.metadata,
      subscription_metadata: sessionParams.subscription_data?.metadata,
    });

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("[Checkout] Session created:", {
      id: session.id,
      mode: session.mode,
      subscription: session.subscription,
      metadata: session.metadata,
    });

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

