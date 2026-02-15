import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@wine-club/lib";
import { prisma } from "@wine-club/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { email, paymentMethodId } = await request.json();

    if (!email || !paymentMethodId) {
      return NextResponse.json(
        { error: "Email and payment method ID are required" },
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

    // Update customer's default payment method in Stripe
    const stripe = getStripeClient(business.stripeAccountId);
    await stripe.customers.update(planSubscription.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Also update all active subscriptions to use this payment method
    const subscriptions = await stripe.subscriptions.list({
      customer: planSubscription.stripeCustomerId,
      status: "active",
    });

    for (const subscription of subscriptions.data) {
      await stripe.subscriptions.update(subscription.id, {
        default_payment_method: paymentMethodId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SET_DEFAULT_PAYMENT_METHOD_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to set default payment method" },
      { status: 500 }
    );
  }
}

