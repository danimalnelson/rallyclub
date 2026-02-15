import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@wine-club/lib";
import { prisma } from "@wine-club/db";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; paymentMethodId: string }> }
) {
  try {
    const { slug, paymentMethodId } = await params;
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
        { error: "No active subscriptions found for this customer" },
        { status: 404 }
      );
    }

    // Verify this payment method belongs to this customer
    const stripe = getStripeClient(business.stripeAccountId);
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (paymentMethod.customer !== planSubscription.stripeCustomerId) {
      return NextResponse.json(
        { error: "Payment method does not belong to this customer" },
        { status: 403 }
      );
    }

    // Check if this is the default payment method
    const customer = await stripe.customers.retrieve(planSubscription.stripeCustomerId);
    if (
      !customer.deleted &&
      customer.invoice_settings.default_payment_method === paymentMethodId
    ) {
      return NextResponse.json(
        { error: "Cannot remove the default payment method. Set another as default first." },
        { status: 400 }
      );
    }

    // Detach the payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE_PAYMENT_METHOD_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to remove payment method" },
      { status: 500 }
    );
  }
}

