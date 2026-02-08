import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";
import { decodeConsumerSession } from "@/lib/consumer-auth";
import { sendEmail, sendBusinessEmail, subscriptionResumedEmail, subscriptionResumedAlertEmail } from "@wine-club/emails";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string; subscriptionId: string }> }
) {
  try {
    const { slug, subscriptionId } = await context.params;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("consumer_session");

    if (!sessionCookie?.value) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = decodeConsumerSession(sessionCookie.value);
    if (!session) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    // Get business
    const business = await prisma.business.findUnique({
      where: { slug },
    });

    if (!business || !business.stripeAccountId) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Get subscription and verify ownership
    const planSubscription = await prisma.planSubscription.findFirst({
      where: {
        id: subscriptionId,
        consumerId: session.consumerId,
        plan: {
          businessId: business.id,
        },
      },
      include: {
        consumer: true,
        plan: true,
      },
    });

    if (!planSubscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    // Resume in Stripe
    const stripe = getStripeClient(business.stripeAccountId);
    const stripeSubscription = await stripe.subscriptions.update(
      planSubscription.stripeSubscriptionId,
      {
        pause_collection: null as any,
      }
    );

    // Update local status
    await prisma.planSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: "active",
        pausedAt: null,
        lastSyncedAt: new Date(),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    });

    // Send resume confirmation email
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const nextBillingDate = new Date(stripeSubscription.current_period_end * 1000);
    const amount = stripeSubscription.items.data[0]?.price?.unit_amount || planSubscription.plan.basePrice || 0;
    const currency = stripeSubscription.items.data[0]?.price?.currency || planSubscription.plan.currency || "usd";

    await sendEmail({
      to: planSubscription.consumer.email,
      subject: `Subscription Resumed - ${business.name}`,
      html: subscriptionResumedEmail({
        customerName: planSubscription.consumer.name || "Valued Member",
        planName: planSubscription.plan.name,
        nextBillingDate: nextBillingDate.toLocaleDateString(),
        amount,
        currency,
        businessName: business.name,
      }),
    });

    // Notify business owner
    if (business.contactEmail) {
      await sendBusinessEmail(
        business.contactEmail,
        `Subscription Resumed - ${planSubscription.consumer.name || planSubscription.consumer.email}`,
        subscriptionResumedAlertEmail({
          businessName: business.name,
          memberName: planSubscription.consumer.name || "Member",
          memberEmail: planSubscription.consumer.email,
          planName: planSubscription.plan.name,
          dashboardUrl: `${publicAppUrl}/app/${business.slug}/members`,
        })
      ).catch((err) => console.error("Failed to send resume notification:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Resume subscription error:", error);
    return NextResponse.json(
      { error: "Failed to resume subscription", details: error.message },
      { status: 500 }
    );
  }
}
