import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function POST() {
  try {
    const results = [];

    // Get all businesses with valid Stripe accounts
    const businesses = await prisma.business.findMany({
      where: {
        stripeAccountId: { 
          not: null,
          notIn: ['acct_12345_placeholder'],
        },
        stripeChargesEnabled: true,
      },
    });

    for (const business of businesses) {
      const stripe = getStripeClient(business.stripeAccountId!);
      
      // Get all subscriptions from Stripe
      const stripeSubs = await stripe.subscriptions.list({
        limit: 100,
        status: "all",
      });

      for (const stripeSub of stripeSubs.data) {
        // Check if it exists in our database
        const existsInDb = await prisma.planSubscription.findUnique({
          where: { stripeSubscriptionId: stripeSub.id },
        });

        if (existsInDb) {
          // Update status if mismatched
          if (existsInDb.status !== stripeSub.status) {
            await prisma.planSubscription.update({
              where: { id: existsInDb.id },
              data: {
                status: stripeSub.status,
                currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
                currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
                cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
              },
            });
            results.push({
              action: "updated",
              subscriptionId: stripeSub.id,
              oldStatus: existsInDb.status,
              newStatus: stripeSub.status,
            });
          }
        } else {
          // Skip canceled subscriptions that were never in our database
          // (These are old subscriptions that were canceled before we started tracking them)
          if (stripeSub.status === "canceled") {
            results.push({
              action: "skipped",
              subscriptionId: stripeSub.id,
              reason: "Canceled subscription not in database (likely old)",
            });
            continue;
          }

          // For active subscriptions, we should investigate why they're missing
          results.push({
            action: "found_missing",
            subscriptionId: stripeSub.id,
            status: stripeSub.status,
            reason: "Active subscription missing from database - manual investigation needed",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      totalActions: results.length,
      results,
    });
  } catch (error: any) {
    console.error("Fix all error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


