import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "slug parameter required" }, { status: 400 });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        memberships: {
          include: {
            plans: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check each plan's Stripe price
    const planDetails = await Promise.all(
      business.memberships.flatMap((membership) =>
        membership.plans.map(async (plan) => {
          let stripePrice = null;
          let stripeProduct = null;

          if (plan.stripePriceId && business.stripeAccountId) {
            try {
              stripePrice = await stripe.prices.retrieve(
                plan.stripePriceId,
                {
                  stripeAccount: business.stripeAccountId,
                }
              );

              if (stripePrice.product && typeof stripePrice.product === "string") {
                stripeProduct = await stripe.products.retrieve(
                  stripePrice.product,
                  {
                    stripeAccount: business.stripeAccountId,
                  }
                );
              }
            } catch (error: any) {
              console.error(`Error fetching Stripe data for plan ${plan.id}:`, error);
            }
          }

          return {
            planId: plan.id,
            planName: plan.name,
            planStatus: plan.status,
            membershipName: membership.name,
            dbStripePriceId: plan.stripePriceId,
            dbStripeProductId: plan.stripeProductId,
            stripePrice: stripePrice
              ? {
                  id: stripePrice.id,
                  type: stripePrice.type, // one_time or recurring
                  recurring: stripePrice.recurring,
                  unitAmount: stripePrice.unit_amount,
                  currency: stripePrice.currency,
                  active: stripePrice.active,
                }
              : null,
            stripeProduct: stripeProduct
              ? {
                  id: stripeProduct.id,
                  name: stripeProduct.name,
                  active: stripeProduct.active,
                }
              : null,
          };
        })
      )
    );

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        stripeAccountId: business.stripeAccountId,
      },
      plans: planDetails,
    });
  } catch (error: any) {
    console.error("Debug plan details error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan details", details: error.message },
      { status: 500 }
    );
  }
}

