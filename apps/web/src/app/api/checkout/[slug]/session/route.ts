import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { createConnectedCheckoutSession, ensureCustomerOnConnectedAccount } from "@wine-club/lib";
import { z } from "zod";

const createSessionSchema = z.object({
  priceId: z.string().min(1),
  consumerEmail: z.string().email().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const { priceId, consumerEmail } = createSessionSchema.parse(body);

    // Find business by slug
    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!business.stripeAccountId) {
      return NextResponse.json(
        { error: "Business has not completed Stripe onboarding" },
        { status: 400 }
      );
    }

    // Verify price belongs to this business
    const price = await prisma.price.findFirst({
      where: {
        id: priceId,
        membershipPlan: {
          businessId: business.id,
          status: "ACTIVE",
        },
      },
      include: {
        membershipPlan: true,
      },
    });

    if (!price || !price.stripePriceId) {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }

    // Get or create customer if email provided
    let customerId: string | undefined;
    if (consumerEmail) {
      let consumer = await prisma.consumer.findUnique({
        where: { email: consumerEmail },
      });

      if (!consumer) {
        consumer = await prisma.consumer.create({
          data: { email: consumerEmail },
        });
      }

      customerId = await ensureCustomerOnConnectedAccount(consumer, business.stripeAccountId);
    }

    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    
    // Create Stripe Checkout Session
    const session = await createConnectedCheckoutSession({
      accountId: business.stripeAccountId,
      priceId: price.stripePriceId,
      successUrl: `${publicAppUrl}/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${publicAppUrl}/${slug}/plans/${price.membershipPlanId}`,
      customerId,
      applicationFeeAmount: Math.floor(price.unitAmount * 0.1), // 10% platform fee
      automaticTax: true,
      metadata: {
        businessId: business.id,
        priceId: price.id,
        planId: price.membershipPlanId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout session error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

