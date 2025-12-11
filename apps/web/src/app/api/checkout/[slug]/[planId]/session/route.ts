import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string; planId: string }> }
) {
  try {
    const { slug, planId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { consumerEmail } = body;

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
    let stripeCustomerId: string | undefined;
    
    if (consumerEmail) {
      const existingConsumer = await prisma.consumer.findUnique({
        where: { email: consumerEmail },
        include: {
          planSubscriptions: {
            take: 5,
            select: { stripeCustomerId: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      const subscriptionWithCustomer = existingConsumer?.planSubscriptions.find(
        sub => sub.stripeCustomerId !== null && sub.stripeCustomerId !== undefined
      );

      if (subscriptionWithCustomer) {
        stripeCustomerId = subscriptionWithCustomer.stripeCustomerId!;
        console.log("[Checkout Session] Reusing existing customer:", stripeCustomerId);
      } else {
        console.log("[Checkout Session] New customer - will create in session");
      }
    } else {
      console.log("[Checkout Session] No email provided - will collect in form");
    }

    // Ensure plan has a Stripe product - create if missing
    let stripeProductId = plan.stripeProductId;
    
    if (!stripeProductId) {
      console.log("[Checkout Session] Plan missing stripeProductId, creating on-the-fly");
      
      try {
        const stripeProduct = await stripe.products.create({
          name: plan.name,
          description: plan.description || undefined,
          metadata: {
            planId: plan.id,
            membershipId: plan.membershipId,
            businessId: business.id,
          },
        });
        
        stripeProductId = stripeProduct.id;
        
        // Update plan with the product ID
        await prisma.plan.update({
          where: { id: plan.id },
          data: { stripeProductId: stripeProduct.id },
        });
        
        console.log("[Checkout Session] Created product:", stripeProduct.id);
      } catch (productError: any) {
        console.error("[Checkout Session] Failed to create product:", productError);
        return NextResponse.json(
          { error: "Failed to create Stripe product", details: productError.message },
          { status: 500 }
        );
      }
    }

    // Ensure plan has a Stripe price - create if missing
    let stripePriceId = plan.stripePriceId;
    
    if (!stripePriceId) {
      console.log("[Checkout Session] Plan missing stripePriceId, creating on-the-fly");
      
      try {
        // Create Stripe Price on-the-fly for this plan
        const stripePrice = await stripe.prices.create({
          currency: plan.currency,
          unit_amount: plan.basePrice || 0,
          recurring: {
            interval: plan.membership.billingInterval.toLowerCase() as "month" | "week" | "year",
            interval_count: 1,
          },
          product: stripeProductId,
          nickname: `${plan.name} - ${plan.membership.billingInterval}`,
        });
        
        stripePriceId = stripePrice.id;
        
        // Update plan with the price ID
        await prisma.plan.update({
          where: { id: plan.id },
          data: { stripePriceId: stripePrice.id },
        });
        
        console.log("[Checkout Session] Created price:", stripePrice.id);
      } catch (priceError: any) {
        console.error("[Checkout Session] Failed to create price:", priceError);
        return NextResponse.json(
          { error: "Failed to create Stripe price", details: priceError.message },
          { status: 500 }
        );
      }
    }

    // Build line items for subscription
    const lineItems: any[] = [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ];

    // Add setup fee as one-time item if exists
    if (plan.setupFee && plan.setupFee > 0) {
      // We'll need to create a one-time price for setup fee
      const setupFeePrice = await stripe.prices.create({
        currency: plan.currency,
        unit_amount: plan.setupFee,
        product_data: {
          name: `${plan.name} - Setup Fee`,
        },
      });
      
      lineItems.push({
        price: setupFeePrice.id,
        quantity: 1,
      });
    }

    // Create Checkout Session for subscription
    // Using embedded checkout with custom Elements
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded",
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      ...(consumerEmail ? { customer_email: consumerEmail } : {}),
      line_items: lineItems,
      payment_method_types: ["card", "link"],
      subscription_data: {
        metadata: {
          planId: plan.id,
          planName: plan.name,
          membershipId: plan.membershipId,
          businessId: business.id,
        },
      },
      metadata: {
        planId: plan.id,
        planName: plan.name,
        membershipId: plan.membershipId,
        businessId: business.id,
        businessSlug: slug,
        ...(consumerEmail ? { consumerEmail } : {}),
      },
    });

    console.log("[Checkout Session] Created:", {
      id: session.id,
      customer: stripeCustomerId,
      planId: plan.id,
    });

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error("Checkout session creation error:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      type: error.type,
      code: error.code,
      raw: error.raw,
    });
    return NextResponse.json(
      { 
        error: "Failed to create checkout session", 
        details: error.message || error.toString(),
        type: error.type,
        code: error.code,
      },
      { status: 500 }
    );
  }
}
