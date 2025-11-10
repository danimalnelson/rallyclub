import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@wine-club/db";
import { verifyWebhookSignature } from "@wine-club/lib";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = verifyWebhookSignature(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Get account ID if this is a Connect webhook
  const accountId = headersList.get("stripe-account") || undefined;

  // Log webhook event
  await prisma.webhookEvent.create({
    data: {
      type: event.type,
      body: event as any,
      signatureValid: true,
      accountId,
    },
  });

  try {
    await handleWebhookEvent(event, accountId);
    
    // Mark as processed
    await prisma.webhookEvent.updateMany({
      where: {
        type: event.type,
        accountId,
      },
      data: {
        processed: true,
      },
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    
    // Log error
    await prisma.webhookEvent.updateMany({
      where: {
        type: event.type,
        accountId,
      },
      data: {
        processingError: error instanceof Error ? error.message : "Unknown error",
      },
    });
    
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleWebhookEvent(event: Stripe.Event, accountId?: string) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, accountId);
      break;

    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription, accountId);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, accountId);
      break;

    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice, accountId);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, accountId);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, accountId?: string) {
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  const subscriptionId = typeof session.subscription === "string" 
    ? session.subscription 
    : session.subscription.id;

  // Get or create consumer
  const consumerEmail = session.customer_email || session.customer_details?.email;
  if (!consumerEmail) {
    throw new Error("No customer email in checkout session");
  }

  let consumer = await prisma.consumer.findUnique({
    where: { email: consumerEmail },
  });

  if (!consumer) {
    consumer = await prisma.consumer.create({
      data: {
        email: consumerEmail,
        name: session.customer_details?.name || undefined,
        phone: session.customer_details?.phone || undefined,
      },
    });
  }

  // Find business by stripeAccountId
  const business = await prisma.business.findUnique({
    where: { stripeAccountId: accountId },
  });

  if (!business) {
    throw new Error(`Business not found for account ${accountId}`);
  }

  // Get or create member
  let member = await prisma.member.findUnique({
    where: {
      businessId_consumerId: {
        businessId: business.id,
        consumerId: consumer.id,
      },
    },
  });

  if (!member) {
    member = await prisma.member.create({
      data: {
        businessId: business.id,
        consumerId: consumer.id,
        status: "ACTIVE",
      },
    });
  }

  // Fetch full subscription from Stripe
  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
    stripeAccount: accountId,
  });

  const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
  
  // Find the price in our DB
  const priceId = subscription.items.data[0]?.price.id;
  const price = await prisma.price.findFirst({
    where: { stripePriceId: priceId },
  });

  if (!price) {
    throw new Error(`Price not found for stripePriceId ${priceId}`);
  }

  // Create or update subscription
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    create: {
      memberId: member.id,
      membershipPlanId: price.membershipPlanId,
      priceId: price.id,
      stripeSubscriptionId: subscriptionId,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: subscription.status as any,
    },
    update: {
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: subscription.status as any,
    },
  });

  // Update member status
  await prisma.member.update({
    where: { id: member.id },
    data: {
      status: mapSubscriptionStatusToMemberStatus(subscription.status),
    },
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, accountId?: string) {
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSub) {
    console.log("Subscription not found in DB, skipping update");
    return;
  }

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      status: subscription.status as any,
    },
  });

  // Update member status
  const member = await prisma.member.findUnique({
    where: { id: existingSub.memberId },
  });

  if (member) {
    await prisma.member.update({
      where: { id: member.id },
      data: {
        status: mapSubscriptionStatusToMemberStatus(subscription.status),
      },
    });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, accountId?: string) {
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { member: true },
  });

  if (!existingSub) {
    return;
  }

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "canceled",
    },
  });

  await prisma.member.update({
    where: { id: existingSub.memberId },
    data: {
      status: "CANCELED",
    },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice, accountId?: string) {
  if (!invoice.subscription) {
    return;
  }

  const subscriptionId = typeof invoice.subscription === "string" 
    ? invoice.subscription 
    : invoice.subscription.id;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { member: true },
  });

  if (!subscription) {
    return;
  }

  // Create transaction record
  await prisma.transaction.create({
    data: {
      businessId: subscription.member.businessId,
      consumerId: subscription.member.consumerId,
      subscriptionId: subscription.id,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      type: "CHARGE",
      stripePaymentIntentId: invoice.payment_intent as string | null,
      stripeChargeId: invoice.charge as string | null,
    },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, accountId?: string) {
  if (!invoice.subscription) {
    return;
  }

  const subscriptionId = typeof invoice.subscription === "string" 
    ? invoice.subscription 
    : invoice.subscription.id;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: { member: true },
  });

  if (!subscription) {
    return;
  }

  // Update member status to PAST_DUE
  await prisma.member.update({
    where: { id: subscription.memberId },
    data: {
      status: "PAST_DUE",
    },
  });
}

function mapSubscriptionStatusToMemberStatus(status: string): "ACTIVE" | "PAST_DUE" | "CANCELED" {
  switch (status) {
    case "active":
    case "trialing":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "ACTIVE";
  }
}

