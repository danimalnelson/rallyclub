import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function POST(req: NextRequest) {
  try {
    const { subscriptionId } = await req.json();
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId required" },
        { status: 400 }
      );
    }

    // Find the subscription in our database
    const planSub = await prisma.planSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!planSub) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Get Stripe subscription
    const stripe = getStripeClient(planSub.plan.business.stripeAccountId);
    const stripeSub = await stripe.subscriptions.retrieve(planSub.stripeSubscriptionId);

    // Update our database with Stripe's status
    const updated = await prisma.planSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: stripeSub.status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    return NextResponse.json({
      success: true,
      before: planSub.status,
      after: updated.status,
      stripeStatus: stripeSub.status,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


