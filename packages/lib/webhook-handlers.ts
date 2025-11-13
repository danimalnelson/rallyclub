/**
 * Webhook Handlers for Stripe Events
 * 
 * Centralized handlers for processing Stripe webhooks.
 * Used by /api/stripe/webhook route.
 */

import Stripe from "stripe";

/**
 * Sync Stripe subscription to PlanSubscription model
 * 
 * Called from webhook handlers (subscription.created, subscription.updated, etc.)
 * 
 * @param prisma - Prisma client instance
 * @param subscription - Stripe subscription object
 * @param accountId - Stripe connected account ID
 */
export async function syncPlanSubscription(
  prisma: any, // TODO: Type with PrismaClient
  subscription: Stripe.Subscription,
  accountId?: string
): Promise<void> {
  // Find existing PlanSubscription by Stripe ID
  const existing = await prisma.planSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existing) {
    // New subscription - will be created by checkout.session.completed handler
    console.log(`[Webhook] New subscription ${subscription.id}, waiting for checkout handler`);
    return;
  }

  // Update existing subscription with latest Stripe data
  await prisma.planSubscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      // Mirror Stripe status exactly (string, not enum)
      status: subscription.status,
      
      // Update billing dates from Stripe
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      
      // Update sync timestamp
      lastSyncedAt: new Date(),
    },
  });

  console.log(`[Webhook] Synced PlanSubscription ${existing.id}: ${subscription.status}`);
}

/**
 * Create PlanSubscription from Stripe Checkout Session
 * 
 * Called from checkout.session.completed webhook
 * 
 * @param prisma - Prisma client instance
 * @param session - Stripe checkout session object
 * @param accountId - Stripe connected account ID
 */
export async function createPlanSubscriptionFromCheckout(
  prisma: any, // TODO: Type with PrismaClient
  session: Stripe.Checkout.Session,
  accountId?: string
): Promise<void> {
  if (session.mode !== "subscription" || !session.subscription) {
    console.log(`[Webhook] Checkout session ${session.id} is not a subscription`);
    return;
  }

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription.id;

  // Check if already exists
  const existing = await prisma.planSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (existing) {
    console.log(`[Webhook] PlanSubscription ${existing.id} already exists for ${subscriptionId}`);
    return;
  }

  // Get metadata from checkout session
  const metadata = session.metadata || {};
  const planId = metadata.planId;

  if (!planId) {
    console.error(`[Webhook] No planId in checkout session ${session.id} metadata`);
    return;
  }

  // Find plan
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { business: true },
  });

  if (!plan) {
    console.error(`[Webhook] Plan ${planId} not found`);
    return;
  }

  // Get customer email
  const customerEmail = session.customer_email || session.customer_details?.email;
  if (!customerEmail) {
    console.error(`[Webhook] No customer email in checkout session ${session.id}`);
    return;
  }

  // Find or create consumer
  let consumer = await prisma.consumer.findUnique({
    where: { email: customerEmail },
  });

  if (!consumer) {
    consumer = await prisma.consumer.create({
      data: {
        email: customerEmail,
        name: session.customer_details?.name || undefined,
        phone: session.customer_details?.phone || undefined,
      },
    });
  }

  // Fetch full subscription from Stripe to get all details
  const stripe = new (await import("stripe")).default(
    process.env.STRIPE_SECRET_KEY!,
    { apiVersion: "2023-10-16", stripeAccount: accountId }
  );
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Create PlanSubscription
  await prisma.planSubscription.create({
    data: {
      planId: plan.id,
      consumerId: consumer.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Parse preferences from metadata if present
      preferences: metadata.preferences ? JSON.parse(metadata.preferences) : null,
      giftFrom: metadata.giftFrom || null,
      giftMessage: metadata.giftMessage || null,
    },
  });

  console.log(`[Webhook] Created PlanSubscription for ${subscription.id}`);
}

/**
 * Handle subscription deletion
 * 
 * @param prisma - Prisma client instance
 * @param subscription - Stripe subscription object
 */
export async function handlePlanSubscriptionDeleted(
  prisma: any, // TODO: Type with PrismaClient
  subscription: Stripe.Subscription
): Promise<void> {
  const existing = await prisma.planSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existing) {
    console.log(`[Webhook] PlanSubscription not found for ${subscription.id}`);
    return;
  }

  // Update status to canceled
  await prisma.planSubscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "canceled",
      lastSyncedAt: new Date(),
    },
  });

  console.log(`[Webhook] Marked PlanSubscription ${existing.id} as canceled`);
}

