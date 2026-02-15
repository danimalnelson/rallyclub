import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@wine-club/lib";
import { prisma } from "@wine-club/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Find the business
    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, stripeAccountId: true },
    });

    if (!business?.stripeAccountId) {
      return NextResponse.json(
        { error: "Business not found or Stripe not connected" },
        { status: 404 }
      );
    }

    // Find the consumer's stripe customer ID via their subscriptions
    // Prefer active subscriptions so we get the current Stripe customer
    const planSubscription = await prisma.planSubscription.findFirst({
      where: {
        consumer: { email },
        plan: { businessId: business.id },
      },
      orderBy: [
        { status: "asc" }, // "active" sorts before "canceled"
        { createdAt: "desc" },
      ],
      select: { stripeCustomerId: true },
    });

    if (!planSubscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscriptions found for this customer" },
        { status: 404 }
      );
    }

    // Create SetupIntent on the connected account
    const stripe = getStripeClient(business.stripeAccountId);
    const setupIntent = await stripe.setupIntents.create({
      customer: planSubscription.stripeCustomerId,
      payment_method_types: ["card"],
      usage: "off_session", // For recurring payments
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error) {
    console.error("[SETUP_INTENT_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to create setup intent" },
      { status: 500 }
    );
  }
}

