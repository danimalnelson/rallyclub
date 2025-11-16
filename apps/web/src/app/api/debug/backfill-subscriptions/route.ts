import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function POST() {
  try {
    const email = "dannelson@icloud.com";
    const business = await prisma.business.findUnique({
      where: { slug: "the-ruby-tap" },
    });

    if (!business || !business.stripeAccountId) {
      return NextResponse.json({ error: "Business not found" });
    }

    const consumer = await prisma.consumer.findUnique({
      where: { email },
    });

    if (!consumer) {
      return NextResponse.json({ error: "Consumer not found" });
    }

    const stripe = getStripeClient(business.stripeAccountId);
    const stripeCustomers = await stripe.customers.list({
      email: email,
      limit: 100,
    });

    const created = [];
    const skipped = [];
    const errors = [];

    for (const customer of stripeCustomers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 100,
      });

      for (const sub of subs.data) {
        // Check if already exists
        const existing = await prisma.planSubscription.findUnique({
          where: { stripeSubscriptionId: sub.id },
        });

        if (existing) {
          skipped.push(sub.id);
          continue;
        }

        // Get plan from subscription metadata or line items
        const lineItem = sub.items.data[0];
        if (!lineItem?.price?.id) {
          errors.push({
            subscriptionId: sub.id,
            error: "No price found",
          });
          continue;
        }

        // Find plan by Stripe price ID
        const plan = await prisma.plan.findFirst({
          where: {
            stripePriceId: lineItem.price.id,
            businessId: business.id,
          },
        });

        if (!plan) {
          errors.push({
            subscriptionId: sub.id,
            error: `Plan not found for price ${lineItem.price.id}`,
          });
          continue;
        }

        // Create PlanSubscription
        try {
          await prisma.planSubscription.create({
            data: {
              planId: plan.id,
              consumerId: consumer.id,
              stripeSubscriptionId: sub.id,
              stripeCustomerId: sub.customer as string,
              status: sub.status,
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              lastSyncedAt: new Date(),
            },
          });

          created.push(sub.id);
        } catch (error: any) {
          errors.push({
            subscriptionId: sub.id,
            error: error.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      errors: errors.length,
      details: {
        created,
        skipped,
        errors,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

