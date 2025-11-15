import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all businesses user has access to
    const businesses = await prisma.business.findMany({
      where: {
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        memberships: {
          include: {
            plans: {
              where: {
                status: "ACTIVE",
              },
            },
          },
        },
      },
    });

    const diagnostics = [];

    for (const business of businesses) {
      const businessDiag: any = {
        businessName: business.name,
        businessSlug: business.slug,
        stripeAccountId: business.stripeAccountId,
        memberships: [],
      };

      // Check if Stripe account is valid
      if (business.stripeAccountId) {
        try {
          const stripe = getStripeClient(business.stripeAccountId);
          const account = await stripe.accounts.retrieve();
          businessDiag.stripeAccountValid = true;
          businessDiag.stripeAccountEmail = account.email;
          businessDiag.stripeAccountChargesEnabled = account.charges_enabled;
        } catch (error: any) {
          businessDiag.stripeAccountValid = false;
          businessDiag.stripeAccountError = error.message;
        }
      } else {
        businessDiag.stripeAccountValid = false;
        businessDiag.stripeAccountError = "No Stripe account connected";
      }

      // Check each membership and plan
      for (const membership of business.memberships) {
        const membershipDiag: any = {
          membershipName: membership.name,
          plans: [],
        };

        for (const plan of membership.plans) {
          const planDiag: any = {
            planName: plan.name,
            planId: plan.id,
            status: plan.status,
            basePrice: plan.basePrice,
            interval: plan.interval,
            stripeProductId: plan.stripeProductId,
            stripePriceId: plan.stripePriceId,
            stripeProductExists: false,
            stripePriceExists: false,
          };

          // Check if Stripe product exists
          if (plan.stripeProductId && business.stripeAccountId) {
            try {
              const stripe = getStripeClient(business.stripeAccountId);
              const product = await stripe.products.retrieve(plan.stripeProductId);
              planDiag.stripeProductExists = true;
              planDiag.stripeProductName = product.name;
              planDiag.stripeProductActive = product.active;
            } catch (error: any) {
              planDiag.stripeProductError = error.message;
            }
          }

          // Check if Stripe price exists
          if (plan.stripePriceId && business.stripeAccountId) {
            try {
              const stripe = getStripeClient(business.stripeAccountId);
              const price = await stripe.prices.retrieve(plan.stripePriceId);
              planDiag.stripePriceExists = true;
              planDiag.stripePriceAmount = price.unit_amount;
              planDiag.stripePriceActive = price.active;
              planDiag.stripePriceRecurring = price.recurring;
            } catch (error: any) {
              planDiag.stripePriceError = error.message;
            }
          }

          membershipDiag.plans.push(planDiag);
        }

        businessDiag.memberships.push(membershipDiag);
      }

      diagnostics.push(businessDiag);
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics,
    });
  } catch (error: any) {
    console.error("Diagnostic error:", error);
    return NextResponse.json(
      { error: "Failed to run diagnostics", details: error.message },
      { status: 500 }
    );
  }
}

