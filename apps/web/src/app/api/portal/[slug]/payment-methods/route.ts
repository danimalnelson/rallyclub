import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@wine-club/lib";
import { prisma } from "@wine-club/db";
import type Stripe from "stripe";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

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
        { error: "No subscriptions found for this customer" },
        { status: 404 }
      );
    }

    // Get payment methods from Stripe
    const stripe = getStripeClient(business.stripeAccountId);
    const customer = await stripe.customers.retrieve(planSubscription.stripeCustomerId);

    if (customer.deleted) {
      return NextResponse.json(
        { error: "Customer has been deleted" },
        { status: 404 }
      );
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: planSubscription.stripeCustomerId,
      type: "card",
    });

    return NextResponse.json({
      paymentMethods: paymentMethods.data.map((pm: Stripe.PaymentMethod) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === customer.invoice_settings.default_payment_method,
      })),
      defaultPaymentMethodId: customer.invoice_settings.default_payment_method,
    });
  } catch (error) {
    console.error("[LIST_PAYMENT_METHODS_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}

