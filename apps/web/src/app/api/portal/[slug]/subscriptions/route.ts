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
    // Include "incomplete" locally — Stripe may have already moved them to "active"
    const planSubscriptions = await prisma.planSubscription.findMany({
      where: {
        consumerId: consumer.id,
        plan: {
          businessId: business.id,
        },
        status: {
          notIn: ["canceled", "incomplete_expired"],
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

    // Fetch Stripe subscription details for each, reconciling stale local statuses
    const stripe = getStripeClient(business.stripeAccountId);
    const subscriptionsWithDetails = (await Promise.all(
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

          // Reconcile: if local status is stale, update it from Stripe
          if (planSub.status !== stripeSubscription.status) {
            console.log(`[Portal] Reconciling PlanSubscription ${planSub.id}: ${planSub.status} → ${stripeSubscription.status}`);
            await prisma.planSubscription.update({
              where: { id: planSub.id },
              data: {
                status: stripeSubscription.status,
                currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                lastSyncedAt: new Date(),
              },
            });
            // Update the local object for the response
            planSub.status = stripeSubscription.status;
          }

          // Skip canceled subscriptions from the response
          if (stripeSubscription.status === "canceled") {
            return null;
          }

          // Get payment method details
          let paymentMethod = null;
          if (typeof stripeSubscription.default_payment_method === "object" && stripeSubscription.default_payment_method) {
            const pm = stripeSubscription.default_payment_method;
            if ('card' in pm) {
              paymentMethod = {
                brand: pm.card?.brand,
                last4: pm.card?.last4,
              };
            }
          }

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
              paymentMethod,
            },
          };
        } catch (error: any) {
          // If Stripe says subscription doesn't exist, mark it as canceled locally
          if (error?.statusCode === 404) {
            console.log(`[Portal] Stripe subscription ${planSub.stripeSubscriptionId} not found, marking canceled`);
            await prisma.planSubscription.update({
              where: { id: planSub.id },
              data: { status: "canceled", lastSyncedAt: new Date() },
            });
            return null;
          }
          console.error(`Failed to fetch Stripe subscription ${planSub.stripeSubscriptionId}:`, error);
          return {
            ...planSub,
            stripeDetails: null,
          };
        }
      })
    )).filter(Boolean);

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

