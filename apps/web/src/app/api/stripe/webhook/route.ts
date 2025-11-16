import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@wine-club/db";
import { verifyWebhookSignature } from "@wine-club/lib";
import {
  sendEmail,
  subscriptionConfirmationEmail,
  paymentFailedEmail,
  refundProcessedEmail,
  subscriptionCancelledEmail,
} from "@wine-club/lib/email";
import {
  createPlanSubscriptionFromCheckout,
  syncPlanSubscription,
  handlePlanSubscriptionDeleted,
  getCurrentPriceForDate,
  getStripeClient,
} from "@wine-club/lib";

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
  
  // Get account ID if this is a Connect webhook
  const accountId = headersList.get("stripe-account") || undefined;

  // Try to verify with appropriate secret
  // Connected account events may or may not have Stripe-Account header
  // Try both secrets if first one fails
  let verificationError: any = null;
  
  try {
    // First, try the connect webhook secret (most common for customer transactions)
    if (process.env.STRIPE_CONNECT_WEBHOOK_SECRET) {
      try {
        console.log("[Webhook] Trying connect webhook secret");
        event = verifyWebhookSignature(
          body,
          signature,
          process.env.STRIPE_CONNECT_WEBHOOK_SECRET
        );
        console.log("[Webhook] ✅ Verified with connect secret");
      } catch (err) {
        verificationError = err;
        // Try platform secret as fallback
        if (process.env.STRIPE_WEBHOOK_SECRET) {
          console.log("[Webhook] Connect secret failed, trying platform secret");
          event = verifyWebhookSignature(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
          );
          console.log("[Webhook] ✅ Verified with platform secret");
        } else {
          throw err;
        }
      }
    } else if (process.env.STRIPE_WEBHOOK_SECRET) {
      // No connect secret configured, use platform secret
      console.log("[Webhook] Using platform webhook secret");
      event = verifyWebhookSignature(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      console.log("[Webhook] ✅ Verified with platform secret");
    } else {
      throw new Error("No webhook secrets configured");
    }
  } catch (err: any) {
    console.error("[Webhook] Signature verification failed:", {
      error: err.message,
      hasConnectSecret: !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      hasPlatformSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasAccountHeader: !!accountId,
      accountId,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

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
    case "account.updated":
      await handleAccountUpdated(event.data.object as Stripe.Account, event.id);
      break;

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

    case "invoice.created":
      await handleInvoiceCreated(event.data.object as Stripe.Invoice, accountId);
      break;

    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Stripe.Invoice, accountId);
      break;

    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, accountId);
      break;

    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge, accountId);
      break;

    case "payment_method.attached":
      await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod, accountId);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, accountId?: string) {
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  // Check if this is a NEW model checkout (has planId in metadata)
  const metadata = session.metadata || {};
  const planId = metadata.planId;

  if (planId) {
    // NEW MODEL: Use PlanSubscription
    console.log(`[Webhook] New model checkout for plan ${planId}`);
    try {
      await createPlanSubscriptionFromCheckout(prisma, session, accountId);
      console.log(`[Webhook] ✅ Created PlanSubscription from checkout ${session.id}`);
      
      // ENFORCE ONE PAYMENT METHOD RULE:
      // Update all other subscriptions to use the same payment method
      await syncPaymentMethodAcrossSubscriptions(session, accountId);
    } catch (error) {
      console.error(`[Webhook] ❌ Failed to create PlanSubscription:`, error);
      throw error;
    }
    return;
  }

  // OLD MODEL: Legacy handling (backward compatibility)
  console.log(`[Webhook] Old model checkout (no planId in metadata)`);

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
  // Try NEW model first
  const planSubscription = await prisma.planSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (planSubscription) {
    // NEW MODEL: Sync PlanSubscription
    console.log(`[Webhook] Syncing new model PlanSubscription ${planSubscription.id}`);
    try {
      await syncPlanSubscription(prisma, subscription, accountId);
      console.log(`[Webhook] ✅ Synced PlanSubscription ${planSubscription.id}`);
    } catch (error) {
      console.error(`[Webhook] ❌ Failed to sync PlanSubscription:`, error);
      throw error;
    }
    return;
  }

  // No PlanSubscription found - check if we should create one from metadata
  const metadata = subscription.metadata || {};
  const planId = metadata.planId;
  
  if (planId) {
    // This is a NEW model subscription that doesn't exist yet - create it!
    console.log(`[Webhook] No PlanSubscription found, creating from subscription metadata for plan ${planId}`);
    try {
      await syncPlanSubscription(prisma, subscription, accountId);
      console.log(`[Webhook] ✅ Created PlanSubscription from subscription event`);
    } catch (error) {
      console.error(`[Webhook] ❌ Failed to create PlanSubscription:`, error);
      throw error;
    }
    return;
  }

  // OLD MODEL: Legacy handling
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existingSub) {
    console.log("[Webhook] Subscription not found in DB, skipping update");
    return;
  }

  console.log(`[Webhook] Updating old model Subscription ${existingSub.id}`);

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
  // Try NEW model first
  const planSubscription = await prisma.planSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      plan: {
        include: {
          membership: true,
          business: true,
        },
      },
      consumer: true,
    },
  });

  if (planSubscription) {
    // NEW MODEL: Handle PlanSubscription deletion
    console.log(`[Webhook] Deleting new model PlanSubscription ${planSubscription.id}`);
    try {
      await handlePlanSubscriptionDeleted(prisma, subscription);
      console.log(`[Webhook] ✅ Deleted PlanSubscription ${planSubscription.id}`);

      // Send cancellation email
      if (planSubscription.consumer.email) {
        const cancellationDate = new Date(subscription.current_period_end * 1000);
        await sendEmail({
          to: planSubscription.consumer.email,
          subject: `Subscription Cancelled - ${planSubscription.plan.business.name}`,
          html: subscriptionCancelledEmail({
            customerName: planSubscription.consumer.name || "Valued Member",
            planName: planSubscription.plan.name,
            cancellationDate: cancellationDate.toLocaleDateString(),
            businessName: planSubscription.plan.business.name,
          }),
        });
      }
    } catch (error) {
      console.error(`[Webhook] ❌ Failed to delete PlanSubscription:`, error);
      throw error;
    }
    return;
  }

  // OLD MODEL: Legacy handling
  const existingSub = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: {
      member: {
        include: {
          consumer: true,
          business: true,
        },
      },
      membershipPlan: true,
    },
  });

  if (!existingSub) {
    console.log("[Webhook] Subscription not found in DB, skipping deletion");
    return;
  }

  console.log(`[Webhook] Deleting old model Subscription ${existingSub.id}`);

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

  // Send cancellation email
  if (existingSub.member.consumer.email) {
    const cancellationDate = new Date(subscription.current_period_end * 1000);
    await sendEmail({
      to: existingSub.member.consumer.email,
      subject: `Subscription Cancelled - ${existingSub.member.business.name}`,
      html: subscriptionCancelledEmail({
        customerName: existingSub.member.consumer.name || "Valued Member",
        planName: existingSub.membershipPlan.name,
        cancellationDate: cancellationDate.toLocaleDateString(),
        businessName: existingSub.member.business.name,
      }),
    });
  }
}

/**
 * Handle invoice.created event for dynamic pricing
 * 
 * When Stripe creates an invoice for a subscription, we check if:
 * 1. The plan is dynamic pricing
 * 2. The invoice has the correct price for the current month
 * 
 * If the price is wrong or missing, we:
 * - Void the invoice
 * - Pause the subscription (if no price available)
 * - OR update the subscription to the correct price and let Stripe recreate the invoice
 */
async function handleInvoiceCreated(invoice: Stripe.Invoice, accountId?: string) {
  console.log(`[Webhook] invoice.created: ${invoice.id}`);

  // Only handle subscription invoices for regular billing cycles
  if (!invoice.subscription || invoice.billing_reason !== "subscription_cycle") {
    console.log(`[Webhook] Skipping: not a subscription cycle invoice`);
    return;
  }

  if (!accountId) {
    console.log(`[Webhook] Skipping: no account ID (platform invoice)`);
    return;
  }

  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription.id;

  const stripe = getStripeClient(accountId);

  // Get Stripe subscription to access metadata
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planId = stripeSubscription.metadata.planId;

  if (!planId) {
    console.log(`[Webhook] No planId in subscription metadata`);
    return;
  }

  // Get plan from database
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      business: true,
      membership: true,
    },
  });

  if (!plan) {
    console.error(`[Webhook] Plan not found: ${planId}`);
    return;
  }

  // Only check dynamic pricing plans
  if (plan.pricingType !== "DYNAMIC") {
    console.log(`[Webhook] Plan ${plan.name} is fixed pricing, skipping check`);
    return;
  }

  console.log(`[Webhook] Checking dynamic pricing for plan: ${plan.name}`);

  // Get the correct price for today
  const correctPriceId = await getCurrentPriceForDate(planId, new Date());

  if (!correctPriceId) {
    console.log(`[Webhook] ❌ No price available for current month - pausing subscription`);

    // Void the invoice
    if (invoice.status === "open") {
      await stripe.invoices.voidInvoice(invoice.id);
      console.log(`[Webhook] Voided invoice ${invoice.id}`);
    }

    // Pause the subscription
    await stripe.subscriptions.update(subscriptionId, {
      pause_collection: {
        behavior: "void",
      },
      metadata: {
        ...stripeSubscription.metadata,
        pausedReason: "MISSING_DYNAMIC_PRICE",
        pausedAt: new Date().toISOString(),
        pausedBySystem: "true",
      },
    });

    console.log(`[Webhook] Paused subscription ${subscriptionId}`);

    // Update PlanSubscription in database
    const planSub = await prisma.planSubscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: { consumer: true },
    });

    if (planSub) {
      await prisma.planSubscription.update({
        where: { id: planSub.id },
        data: { pausedAt: new Date() },
      });

      // Create alert
      await prisma.businessAlert.create({
        data: {
          businessId: plan.businessId,
          type: "SUBSCRIPTION_PAUSED",
          severity: "URGENT",
          title: `Subscription Paused: ${planSub.consumer.name || planSub.consumer.email}`,
          message: `Subscription paused due to missing price for ${plan.name}. Set the current month's price to resume billing.`,
          metadata: {
            planId: plan.id,
            planName: plan.name,
            subscriptionId: planSub.id,
            stripeSubscriptionId: subscriptionId,
            consumerId: planSub.consumerId,
            consumerEmail: planSub.consumer.email,
            consumerName: planSub.consumer.name,
            voidedInvoiceId: invoice.id,
            pauseReason: "MISSING_DYNAMIC_PRICE",
            billingDate: new Date().toISOString(),
          },
        },
      });

      console.log(`[Webhook] Created alert for paused subscription`);
    }

    return;
  }

  // Check if invoice has the correct price
  const invoicePriceId = invoice.lines.data[0]?.price?.id;

  if (invoicePriceId === correctPriceId) {
    console.log(`[Webhook] ✅ Invoice has correct price: ${correctPriceId}`);
    return; // All good, let invoice process normally
  }

  console.log(`[Webhook] ⚠️  Price mismatch! Invoice: ${invoicePriceId}, Should be: ${correctPriceId}`);

  // Void the invoice
  if (invoice.status === "open") {
    await stripe.invoices.voidInvoice(invoice.id);
    console.log(`[Webhook] Voided invoice ${invoice.id}`);
  }

  // Update subscription to correct price
  await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: stripeSubscription.items.data[0].id,
        price: correctPriceId,
      },
    ],
    proration_behavior: "none",
    metadata: {
      ...stripeSubscription.metadata,
      lastPriceUpdate: new Date().toISOString(),
      updatedByWebhook: "true",
    },
  });

  console.log(`[Webhook] ✅ Updated subscription to correct price: ${correctPriceId}`);
  console.log(`[Webhook] Stripe will automatically create new invoice with correct price`);
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
    include: {
      member: {
        include: {
          consumer: true,
        },
      },
      membershipPlan: true,
      price: true,
    },
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

  // Send confirmation email on successful payment
  // Note: More sophisticated logic could check if this is the first invoice
  if (subscription.member.consumer.email && invoice.billing_reason === "subscription_create") {
    const business = await prisma.business.findUnique({
      where: { id: subscription.member.businessId },
    });

    if (business) {
      await sendEmail({
        to: subscription.member.consumer.email,
        subject: `Welcome to ${business.name}!`,
        html: subscriptionConfirmationEmail({
          customerName: subscription.member.consumer.name || "Valued Member",
          planName: subscription.membershipPlan.name,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          interval: subscription.price.interval,
          businessName: business.name,
        }),
      });
    }
  }
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
    include: {
      member: {
        include: {
          consumer: true,
        },
      },
      membershipPlan: true,
    },
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

  // Send payment failed email
  const business = await prisma.business.findUnique({
    where: { id: subscription.member.businessId },
  });

  if (business && subscription.member.consumer.email) {
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    await sendEmail({
      to: subscription.member.consumer.email,
      subject: `Payment Update Required - ${business.name}`,
      html: paymentFailedEmail({
        customerName: subscription.member.consumer.name || "Valued Member",
        planName: subscription.membershipPlan.name,
        amount: invoice.amount_due,
        currency: invoice.currency,
        businessName: business.name,
        portalUrl: `${publicAppUrl}/${business.slug}/portal`,
      }),
    });
  }
}

async function handleChargeRefunded(charge: Stripe.Charge, accountId?: string) {
  // Find the transaction
  const transaction = await prisma.transaction.findFirst({
    where: {
      stripeChargeId: charge.id,
    },
    include: {
      consumer: true,
      business: true,
    },
  });

  if (!transaction) {
    console.log("Transaction not found for refunded charge:", charge.id);
    return;
  }

  // Create refund transaction
  await prisma.transaction.create({
    data: {
      businessId: transaction.businessId,
      consumerId: transaction.consumerId,
      subscriptionId: transaction.subscriptionId,
      amount: charge.amount_refunded,
      currency: charge.currency,
      type: "REFUND",
      stripeChargeId: charge.id,
    },
  });

  // Send refund email
  if (transaction.consumer.email) {
    await sendEmail({
      to: transaction.consumer.email,
      subject: `Refund Processed - ${transaction.business.name}`,
      html: refundProcessedEmail({
        customerName: transaction.consumer.name || "Valued Customer",
        amount: charge.amount_refunded,
        currency: charge.currency,
        businessName: transaction.business.name,
      }),
    });
  }
}

async function handleAccountUpdated(account: Stripe.Account, eventId?: string) {
  if (!account.id) {
    console.log("[Webhook] account.updated: missing account.id");
    return;
  }

  const business = await prisma.business.findUnique({
    where: { stripeAccountId: account.id },
    include: {
      users: {
        take: 1,
      },
    },
  });

  if (!business) {
    console.log(`[Webhook] account.updated: no business found for account ${account.id}`);
    return;
  }

  // Check for duplicate webhook (idempotency)
  if (eventId && business.lastWebhookEventId === eventId) {
    console.log(`[Webhook] account.updated: duplicate event ${eventId}, skipping`);
    return;
  }

  // Import state machine utilities
  const { determineBusinessState, createStateTransition, appendTransition, isValidTransition } = await import("@wine-club/lib");

  // Determine new state based on Stripe account
  const stripeAccountState = {
    id: account.id,
    charges_enabled: account.charges_enabled,
    details_submitted: account.details_submitted,
    payouts_enabled: account.payouts_enabled,
    requirements: account.requirements,
    capabilities: account.capabilities,
  };

  const newStatus = determineBusinessState(business.status, stripeAccountState);
  const statusChanged = newStatus !== business.status;

  console.log(`[Webhook] account.updated: ${account.id} | status: ${business.status} → ${newStatus} | charges: ${account.charges_enabled} | details: ${account.details_submitted}`);

  // Validate transition
  if (statusChanged && !isValidTransition(business.status, newStatus)) {
    console.warn(`[Webhook] account.updated: invalid transition ${business.status} → ${newStatus}, allowing anyway for webhook-driven updates`);
  }

  // Prepare update data
  const updateData: any = {
    contactEmail: account.business_profile?.support_email || account.email || business.contactEmail,
    contactPhone: account.business_profile?.support_phone || business.contactPhone,
    website: account.business_profile?.url || business.website,
    stripeChargesEnabled: account.charges_enabled,
    stripeDetailsSubmitted: account.details_submitted,
    stripeRequirements: account.requirements || null,
    lastWebhookEventId: eventId || business.lastWebhookEventId,
  };

  // Update status if changed
  if (statusChanged) {
    updateData.status = newStatus;
    
    // Create state transition record
    const transition = createStateTransition(
      business.status,
      newStatus,
      `Webhook account.updated: charges=${account.charges_enabled}, details=${account.details_submitted}`,
      eventId
    );
    
    updateData.stateTransitions = appendTransition(
      business.stateTransitions as any,
      transition
    );
  }

  // Update business
  await prisma.business.update({
    where: { id: business.id },
    data: updateData,
  });

  // Create audit log for significant events
  if (statusChanged && newStatus === "ONBOARDING_COMPLETE" && business.users.length > 0) {
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: business.users[0]?.userId ?? undefined,
        type: "STRIPE_ONBOARDING_COMPLETE",
        metadata: {
          accountId: account.id,
          charges_enabled: account.charges_enabled,
          details_submitted: account.details_submitted,
          previous_status: business.status,
          new_status: newStatus,
        },
      },
    });
    
    console.log(`[Webhook] account.updated: ✅ Onboarding complete for business ${business.id}`);
  } else if (statusChanged && newStatus === "RESTRICTED") {
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: business.users[0]?.userId ?? undefined,
        type: "STRIPE_ACCOUNT_RESTRICTED",
        metadata: {
          accountId: account.id,
          requirements: account.requirements ? JSON.parse(JSON.stringify(account.requirements)) : null,
          previous_status: business.status,
        },
      },
    });
    
    console.log(`[Webhook] account.updated: ⚠️  Account restricted for business ${business.id}`);
  }
}

/**
 * Helper: Sync payment method across all subscriptions for a customer
 * Enforces the "one payment method per customer" rule
 */
async function syncPaymentMethodAcrossSubscriptions(session: Stripe.Checkout.Session, accountId?: string) {
  if (!session.customer || typeof session.customer !== 'string') {
    console.log(`[Webhook] syncPaymentMethod: No customer in session, skipping`);
    return;
  }

  if (!accountId) {
    console.log(`[Webhook] syncPaymentMethod: No accountId, skipping`);
    return;
  }

  try {
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
      typescript: true,
      stripeAccount: accountId,
    });

    // Get the subscription that was just created
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription?.id;

    if (!subscriptionId) {
      console.log(`[Webhook] syncPaymentMethod: No subscription ID, skipping`);
      return;
    }

    // Retrieve the subscription to get its payment method
    const newSubscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    const paymentMethodId = newSubscription.default_payment_method;

    if (!paymentMethodId || typeof paymentMethodId !== 'string') {
      console.log(`[Webhook] syncPaymentMethod: No payment method on new subscription, skipping`);
      return;
    }

    console.log(`[Webhook] syncPaymentMethod: Using payment method ${paymentMethodId} for customer ${session.customer}`);

    // Get all OTHER active subscriptions for this customer
    const allSubscriptions = await stripeClient.subscriptions.list({
      customer: session.customer,
      status: "active",
    });

    const otherSubscriptions = allSubscriptions.data.filter(sub => sub.id !== subscriptionId);
    console.log(`[Webhook] syncPaymentMethod: Found ${otherSubscriptions.length} other active subscriptions to update`);

    // Update each subscription to use the same payment method
    for (const subscription of otherSubscriptions) {
      try {
        await stripeClient.subscriptions.update(subscription.id, {
          default_payment_method: paymentMethodId,
        });
        console.log(`[Webhook] syncPaymentMethod: ✅ Updated subscription ${subscription.id}`);
      } catch (error) {
        console.error(`[Webhook] syncPaymentMethod: ❌ Failed to update subscription ${subscription.id}:`, error);
      }
    }

    // Also set as customer's default
    await stripeClient.customers.update(session.customer, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log(`[Webhook] syncPaymentMethod: ✅ Updated ${otherSubscriptions.length} subscriptions and customer default`);
  } catch (error) {
    console.error(`[Webhook] syncPaymentMethod: ❌ Error:`, error);
  }
}

/**
 * Handle payment_method.attached event
 * When a payment method is attached to a customer, update ALL active subscriptions
 * to use this payment method (enforce one payment method per customer rule)
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod, accountId?: string) {
  console.log(`[Webhook] payment_method.attached: ${paymentMethod.id} for customer ${paymentMethod.customer}`);

  if (!paymentMethod.customer || typeof paymentMethod.customer !== 'string') {
    console.log(`[Webhook] payment_method.attached: No customer attached, skipping`);
    return;
  }

  if (!accountId) {
    console.log(`[Webhook] payment_method.attached: No accountId, skipping`);
    return;
  }

  try {
    // Get Stripe client for this connected account
    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2023-10-16",
      typescript: true,
      stripeAccount: accountId,
    });

    // Get all active subscriptions for this customer
    const subscriptions = await stripeClient.subscriptions.list({
      customer: paymentMethod.customer,
      status: "active",
    });

    console.log(`[Webhook] payment_method.attached: Found ${subscriptions.data.length} active subscriptions`);

    // Update each subscription to use the new payment method
    for (const subscription of subscriptions.data) {
      try {
        await stripeClient.subscriptions.update(subscription.id, {
          default_payment_method: paymentMethod.id,
        });
        console.log(`[Webhook] payment_method.attached: ✅ Updated subscription ${subscription.id}`);
      } catch (error) {
        console.error(`[Webhook] payment_method.attached: ❌ Failed to update subscription ${subscription.id}:`, error);
      }
    }

    // Also set as customer's default
    await stripeClient.customers.update(paymentMethod.customer, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    console.log(`[Webhook] payment_method.attached: ✅ Set as customer default`);
  } catch (error) {
    console.error(`[Webhook] payment_method.attached: ❌ Error:`, error);
  }
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

