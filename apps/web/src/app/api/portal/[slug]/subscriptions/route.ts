import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";
import { decodeConsumerSession } from "@/lib/consumer-auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("consumer_session");

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Decode and verify session
    const session = decodeConsumerSession(sessionCookie.value);

    if (!session) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Get consumer from database
    const consumer = await prisma.consumer.findUnique({
      where: { id: session.consumerId },
    });

    if (!consumer) {
      return NextResponse.json({ error: "Consumer not found" }, { status: 404 });
    }

    // Get business
    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business || !business.stripeAccountId) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Find all plan subscriptions for this consumer
    const planSubscriptions = await prisma.planSubscription.findMany({
      where: {
        consumerId: consumer.id,
        plan: {
          businessId: business.id,
        },
      },
      include: {
        plan: {
          include: {
            membership: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Fetch Stripe subscription details for each
    const stripe = getStripeClient(business.stripeAccountId);
    const subscriptionsWithDetails = await Promise.all(
      planSubscriptions.map(async (planSub) => {
        try {
          if (!planSub.stripeSubscriptionId) {
            return {
              ...planSub,
              stripeDetails: null,
            };
          }

          const stripeSubscription = await stripe.subscriptions.retrieve(
            planSub.stripeSubscriptionId,
            { expand: ["default_payment_method", "latest_invoice"] }
          );

          return {
            ...planSub,
            stripeDetails: {
              status: stripeSubscription.status,
              currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              cancelAt: stripeSubscription.cancel_at
                ? new Date(stripeSubscription.cancel_at * 1000)
                : null,
              trialEnd: stripeSubscription.trial_end
                ? new Date(stripeSubscription.trial_end * 1000)
                : null,
            },
          };
        } catch (error) {
          console.error(`Failed to fetch Stripe subscription ${planSub.stripeSubscriptionId}:`, error);
          return {
            ...planSub,
            stripeDetails: null,
          };
        }
      })
    );

    return NextResponse.json({
      subscriptions: subscriptionsWithDetails,
      consumer: {
        email: consumer.email,
        name: consumer.name,
      },
    });
  } catch (error: any) {
    console.error("Fetch subscriptions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions", details: error.message },
      { status: 500 }
    );
  }
}

