import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";

export async function GET() {
  try {
    const email = "dannelson@icloud.com";
    const business = await prisma.business.findUnique({
      where: { slug: "the-ruby-tap" },
    });

    if (!business || !business.stripeAccountId) {
      return NextResponse.json({ error: "Business not found" });
    }

    // Get from database
    const consumer = await prisma.consumer.findUnique({
      where: { email },
    });

    if (!consumer) {
      return NextResponse.json({ error: "Consumer not found" });
    }

    const dbSubscriptions = await prisma.planSubscription.findMany({
      where: {
        consumerId: consumer.id,
        plan: { businessId: business.id },
      },
      include: { plan: true },
    });

    // Get from Stripe
    const stripe = getStripeClient(business.stripeAccountId);
    const stripeCustomers = await stripe.customers.list({
      email: email,
      limit: 100,
    });

    const stripeData = [];
    for (const customer of stripeCustomers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 100,
      });

      for (const sub of subs.data) {
        const inDb = dbSubscriptions.find(
          (dbSub) => dbSub.stripeSubscriptionId === sub.id
        );
        stripeData.push({
          subscriptionId: sub.id,
          customerId: customer.id,
          status: sub.status,
          inDatabase: !!inDb,
          created: new Date(sub.created * 1000),
        });
      }
    }

    return NextResponse.json({
      email,
      database: {
        count: dbSubscriptions.length,
        subscriptions: dbSubscriptions.map((s) => ({
          id: s.stripeSubscriptionId,
          status: s.status,
          plan: s.plan.name,
        })),
      },
      stripe: {
        customerCount: stripeCustomers.data.length,
        subscriptionCount: stripeData.length,
        subscriptions: stripeData,
      },
      missing: stripeData.filter((s) => !s.inDatabase),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

