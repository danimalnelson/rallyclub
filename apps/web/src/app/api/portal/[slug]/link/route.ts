import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { createCustomerPortalLink } from "@wine-club/lib";
import { z } from "zod";

const createPortalLinkSchema = z.object({
  consumerEmail: z.string().email(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { consumerEmail } = createPortalLinkSchema.parse(body);

    // Find business
    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business || !business.stripeAccountId) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Find consumer
    const consumer = await prisma.consumer.findUnique({
      where: { email: consumerEmail },
    });

    if (!consumer) {
      return NextResponse.json({ error: "Consumer not found" }, { status: 404 });
    }

    // Find member
    const member = await prisma.member.findUnique({
      where: {
        businessId_consumerId: {
          businessId: business.id,
          consumerId: consumer.id,
        },
      },
      include: {
        subscriptions: {
          where: {
            status: {
              in: ["active", "trialing", "past_due"],
            },
          },
          take: 1,
        },
      },
    });

    if (!member || member.subscriptions.length === 0) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    // Get Stripe customer ID from subscription
    const Stripe = require("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      stripeAccount: business.stripeAccountId,
    });

    const subscription = await stripe.subscriptions.retrieve(
      member.subscriptions[0].stripeSubscriptionId
    );
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    
    const portalUrl = await createCustomerPortalLink({
      accountId: business.stripeAccountId,
      customerId,
      returnUrl: `${publicAppUrl}/${slug}/portal`,
    });

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    console.error("Portal link error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create portal link" },
      { status: 500 }
    );
  }
}

