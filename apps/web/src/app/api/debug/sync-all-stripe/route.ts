import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function GET() {
  try {
    // Get all businesses with valid Stripe accounts
    const businesses = await prisma.business.findMany({
      where: {
        stripeAccountId: { 
          not: null,
          notIn: ['acct_12345_placeholder'], // Exclude placeholder accounts
        },
        stripeChargesEnabled: true, // Only check businesses that can charge
      },
    });

    if (businesses.length === 0) {
      return NextResponse.json({
        message: "No businesses with valid Stripe accounts found",
        total: 0,
        issues: [],
      });
    }

    const results = [];

    for (const business of businesses) {
      try {
        console.log(`[Sync Check] Checking business: ${business.name} (${business.stripeAccountId})`);
        const stripe = getStripeClient(business.stripeAccountId!);
        
        // Get all subscriptions from Stripe
        const stripeSubs = await stripe.subscriptions.list({
          limit: 100,
          status: "all",
        });
        
        console.log(`[Sync Check] Found ${stripeSubs.data.length} subscriptions in Stripe`);

      for (const stripeSub of stripeSubs.data) {
        // Check if it exists in our database
        const existsInDb = await prisma.planSubscription.findUnique({
          where: { stripeSubscriptionId: stripeSub.id },
        });

        if (!existsInDb) {
          results.push({
            stripeSubId: stripeSub.id,
            status: stripeSub.status,
            customer: stripeSub.customer,
            planId: stripeSub.metadata?.planId,
            existsInDb: false,
            reason: "Missing from database",
          });
        } else {
          // Check if status matches
          if (existsInDb.status !== stripeSub.status) {
            results.push({
              stripeSubId: stripeSub.id,
              status: stripeSub.status,
              dbStatus: existsInDb.status,
              existsInDb: true,
              reason: "Status mismatch",
            });
          }
        }
      }
      } catch (businessError: any) {
        console.error(`[Sync Check] Error for business ${business.id}:`, businessError.message);
        results.push({
          businessId: business.id,
          businessName: business.name,
          error: businessError.message,
        });
      }
    }

    return NextResponse.json({
      total: results.length,
      issues: results,
    });
  } catch (error: any) {
    console.error("Sync check error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

