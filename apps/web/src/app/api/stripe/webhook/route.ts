import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { prisma } from "@wine-club/db";
import { verifyWebhookSignature } from "@wine-club/lib";
import {
  sendEmail,
  sendBusinessEmail,
  // Member emails
  subscriptionConfirmationEmail,
  paymentFailedEmail,
  refundProcessedEmail,
  subscriptionCancelledEmail,
  cancellationScheduledEmail,
  // Business owner emails
  newMemberEmail,
  memberChurnedEmail,
  cancellationScheduledAlertEmail,
  paymentAlertEmail,
  subscriptionPausedAlertEmail,
  subscriptionResumedAlertEmail,
  paymentReceivedEmail,
} from "@wine-club/emails";
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

  // Idempotency: skip if we've already processed this Stripe event (prevents duplicate emails on retries)
  const alreadyProcessed = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT 1 as count FROM webhook_events 
    WHERE (body->>'id') = ${event.id} AND processed = true 
    LIMIT 1
  `;
  if (alreadyProcessed.length > 0) {
    console.log(`[Webhook] Idempotency: event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, idempotent: true });
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

      // Send business owner notification for new member
      await notifyBusinessOwnerNewMember(session, planId);
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
    const oldStatus = planSubscription.status;
    const oldCancelAtPeriodEnd = planSubscription.cancelAtPeriodEnd;
    console.log(`[Webhook] Syncing new model PlanSubscription ${planSubscription.id}`);
    try {
      await syncPlanSubscription(prisma, subscription, accountId);
      console.log(`[Webhook] ✅ Synced PlanSubscription ${planSubscription.id}`);

      // Detect status transitions and notify business owner
      const newStatus = subscription.status;
      if (oldStatus !== newStatus) {
        await notifyBusinessSubscriptionStatusChange(planSubscription.id, oldStatus, newStatus);
      }

      // Detect cancellation scheduled (cancelAtPeriodEnd changed false → true)
      if (!oldCancelAtPeriodEnd && subscription.cancel_at_period_end) {
        console.log(`[Webhook] Cancellation scheduled for PlanSubscription ${planSubscription.id}`);
        await handleCancellationScheduled(planSubscription.id, subscription);
      }
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
    const cancelDetails = (subscription as any).cancellation_details;
    console.log(`[Webhook] Deleting new model PlanSubscription ${planSubscription.id}`, {
      subscriptionId: subscription.id,
      cancellationDetails: cancelDetails
        ? {
            reason: cancelDetails.reason,
            feedback: cancelDetails.feedback,
            comment: cancelDetails.comment ? "(present)" : undefined,
          }
        : null,
    });
    try {
      await handlePlanSubscriptionDeleted(prisma, subscription);
      console.log(`[Webhook] ✅ Deleted PlanSubscription ${planSubscription.id}`);

      // Send cancellation email to member
      if (planSubscription.consumer.email) {
        const cancellationDate = new Date(subscription.current_period_end * 1000);
        console.log(`[Webhook] Sending subscription cancelled email to ${planSubscription.consumer.email} for sub ${subscription.id}`);
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

      // Notify business owner of churned member
      await notifyBusinessOwnerMemberChurned(planSubscription, subscription);
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
    console.log(`[Webhook] Sending subscription cancelled email (legacy) to ${existingSub.member.consumer.email} for sub ${subscription.id}`);
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

  // Try OLD model first
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

  if (subscription) {
    // OLD MODEL: Create transaction linked to old Subscription
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

    const business = await prisma.business.findUnique({
      where: { id: subscription.member.businessId },
    });

    // Send confirmation email on first payment (subscription create)
    if (subscription.member.consumer.email && invoice.billing_reason === "subscription_create" && business) {
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

    // Notify business owner of every successful payment
    if (business && invoice.amount_paid > 0) {
      const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
      const paymentDate = new Date(invoice.created * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      await sendBusinessNotification(
        business.id,
        "paymentReceived",
        `Payment Received - $${(invoice.amount_paid / 100).toFixed(2)} from ${subscription.member.consumer.name || subscription.member.consumer.email}`,
        paymentReceivedEmail({
          businessName: business.name,
          memberName: subscription.member.consumer.name || "Member",
          memberEmail: subscription.member.consumer.email,
          planName: subscription.membershipPlan.name,
          amount: invoice.amount_paid,
          currency: invoice.currency,
          paymentDate,
          dashboardUrl: `${publicAppUrl}/app/${business.slug}/transactions`,
        }),
        business.contactEmail
      );
    }
    return;
  }

  // NEW MODEL: Try PlanSubscription
  const planSubscription = await prisma.planSubscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
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

  if (!planSubscription) {
    console.log(`[Webhook] invoice.paid: No subscription found for ${subscriptionId}`);
    return;
  }

  const business = planSubscription.plan.business;

  // Create transaction record (without old subscriptionId link)
  await prisma.transaction.create({
    data: {
      businessId: business.id,
      consumerId: planSubscription.consumerId,
      amount: invoice.amount_paid,
      currency: invoice.currency,
      type: "CHARGE",
      stripePaymentIntentId: invoice.payment_intent as string | null,
      stripeChargeId: invoice.charge as string | null,
    },
  });

  console.log(`[Webhook] ✅ Created CHARGE transaction for PlanSubscription ${planSubscription.id}: ${invoice.amount_paid} ${invoice.currency}`);

  // Send confirmation email on first payment (subscription create)
  if (planSubscription.consumer.email && invoice.billing_reason === "subscription_create") {
    try {
      const priceAmount = invoice.amount_paid;
      const priceCurrency = invoice.currency;
      const interval = planSubscription.plan.membership.billingInterval?.toLowerCase() || "month";

      await sendEmail({
        to: planSubscription.consumer.email,
        subject: `Welcome to ${business.name}!`,
        html: subscriptionConfirmationEmail({
          customerName: planSubscription.consumer.name || "Valued Member",
          planName: planSubscription.plan.name,
          amount: priceAmount,
          currency: priceCurrency,
          interval,
          businessName: business.name,
        }),
      });
    } catch (emailError) {
      console.error(`[Webhook] Failed to send confirmation email:`, emailError);
    }
  }

  // Notify business owner of every successful payment
  if (invoice.amount_paid > 0) {
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const paymentDate = new Date(invoice.created * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    await sendBusinessNotification(
      business.id,
      "paymentReceived",
      `Payment Received - $${(invoice.amount_paid / 100).toFixed(2)} from ${planSubscription.consumer.name || planSubscription.consumer.email}`,
      paymentReceivedEmail({
        businessName: business.name,
        memberName: planSubscription.consumer.name || "Member",
        memberEmail: planSubscription.consumer.email,
        planName: planSubscription.plan.name,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        paymentDate,
        dashboardUrl: `${publicAppUrl}/app/${business.slug}/transactions`,
      }),
      business.contactEmail
    );
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
    
    // Send payment failed email to member
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

    // Notify business owner of payment failure
    await sendBusinessNotification(
      business.id,
      "paymentFailed",
      `Payment Failed Alert - ${subscription.member.consumer.name || subscription.member.consumer.email}`,
      paymentAlertEmail({
        businessName: business.name,
        memberName: subscription.member.consumer.name || "Member",
        memberEmail: subscription.member.consumer.email,
        planName: subscription.membershipPlan.name,
        amount: invoice.amount_due,
        currency: invoice.currency,
        dashboardUrl: `${publicAppUrl}/app/${business.slug}/members`,
      }),
      business.contactEmail
    );
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
/**
 * Upsert local PaymentMethod record from a Stripe PaymentMethod.
 * Finds the consumer via stripeCustomerId on PlanSubscription,
 * marks the new method as default, and un-defaults all others.
 */
async function upsertLocalPaymentMethod(
  stripePaymentMethod: Stripe.PaymentMethod,
  stripeCustomerId: string
) {
  try {
    // Find the consumer via their Stripe customer ID on any PlanSubscription
    const subscription = await prisma.planSubscription.findFirst({
      where: { stripeCustomerId },
      select: { consumerId: true },
    });

    if (!subscription) {
      console.log(`[Webhook] upsertLocalPaymentMethod: No local subscription found for customer ${stripeCustomerId}, skipping`);
      return;
    }

    const consumerId = subscription.consumerId;
    const card = stripePaymentMethod.card;

    // Un-default all existing payment methods for this consumer
    await prisma.paymentMethod.updateMany({
      where: { consumerId, isDefault: true },
      data: { isDefault: false },
    });

    // Upsert the payment method
    await prisma.paymentMethod.upsert({
      where: { stripePaymentMethodId: stripePaymentMethod.id },
      create: {
        consumerId,
        stripePaymentMethodId: stripePaymentMethod.id,
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        expMonth: card?.exp_month ?? null,
        expYear: card?.exp_year ?? null,
        isDefault: true,
      },
      update: {
        brand: card?.brand ?? null,
        last4: card?.last4 ?? null,
        expMonth: card?.exp_month ?? null,
        expYear: card?.exp_year ?? null,
        isDefault: true,
      },
    });

    console.log(`[Webhook] upsertLocalPaymentMethod: ✅ Stored ${card?.brand} •••• ${card?.last4} for consumer ${consumerId}`);
  } catch (error) {
    console.error(`[Webhook] upsertLocalPaymentMethod: ❌ Error:`, error);
  }
}

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

    // Retrieve full payment method details and store locally
    const paymentMethodDetails = await stripeClient.paymentMethods.retrieve(paymentMethodId);
    await upsertLocalPaymentMethod(paymentMethodDetails, session.customer);

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

    // Store locally
    await upsertLocalPaymentMethod(paymentMethod, paymentMethod.customer);

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

/**
 * Notify business owner of new member signup
 */
async function notifyBusinessOwnerNewMember(
  session: Stripe.Checkout.Session,
  planId: string
) {
  try {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: { business: true },
    });

    if (!plan) {
      console.log(`[Webhook] Plan ${planId} not found for new member notification`);
      return;
    }

    const customerName = session.customer_details?.name || "New Member";
    const customerEmail = session.customer_email || session.customer_details?.email || "Unknown";
    const amount = session.amount_total || 0;
    const currency = session.currency || "usd";
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";

    await sendBusinessNotification(
      plan.business.id,
      "newMember",
      `New Member Signup - ${customerName}`,
      newMemberEmail({
        businessName: plan.business.name,
        memberName: customerName,
        memberEmail: customerEmail,
        planName: plan.name,
        amount,
        currency,
        dashboardUrl: `${publicAppUrl}/app/${plan.business.slug}/members`,
      }),
      plan.business.contactEmail
    );
  } catch (error) {
    console.error(`[Webhook] Failed to send new member notification:`, error);
    // Don't throw - notification failure shouldn't fail the webhook
  }
}

/**
 * Notify business owner of member churn (cancellation)
 */
async function notifyBusinessOwnerMemberChurned(
  planSubscription: {
    consumer: { name: string | null; email: string };
    plan: {
      name: string;
      businessId: string;
      business: { id: string; name: string; slug: string | null; contactEmail: string | null };
    };
    createdAt: Date;
  },
  subscription: Stripe.Subscription
) {
  try {
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    
    // Calculate total spent (simplified - ideally would sum transactions)
    const totalSpent = 0; // TODO: Could query transactions for actual total

    await sendBusinessNotification(
      planSubscription.plan.business.id,
      "subscriptionCanceled",
      `Member Cancelled - ${planSubscription.consumer.name || planSubscription.consumer.email}`,
      memberChurnedEmail({
        businessName: planSubscription.plan.business.name,
        memberName: planSubscription.consumer.name || "Member",
        memberEmail: planSubscription.consumer.email,
        planName: planSubscription.plan.name,
        memberSince: planSubscription.createdAt.toLocaleDateString(),
        totalSpent,
        currency: "usd",
        dashboardUrl: `${publicAppUrl}/app/${planSubscription.plan.business.slug}/members`,
      }),
      planSubscription.plan.business.contactEmail
    );

    console.log(`[Webhook] ✉️ Sent churn notification to ${planSubscription.plan.business.contactEmail}`);
  } catch (error) {
    console.error(`[Webhook] Failed to send churn notification:`, error);
    // Don't throw - notification failure shouldn't fail the webhook
  }
}

/**
 * Notify business owner of subscription status changes (pause/resume)
 */
async function notifyBusinessSubscriptionStatusChange(
  planSubscriptionId: string,
  oldStatus: string,
  newStatus: string
) {
  try {
    const planSubscription = await prisma.planSubscription.findUnique({
      where: { id: planSubscriptionId },
      include: {
        consumer: true,
        plan: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!planSubscription) return;

    const business = planSubscription.plan.business;
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
    const dashboardUrl = `${publicAppUrl}/app/${business.slug}/members`;

    // Subscription paused
    if (newStatus === "paused" && oldStatus !== "paused") {
      await sendBusinessNotification(
        business.id,
        "subscriptionPaused",
        `Subscription Paused - ${planSubscription.consumer.name || planSubscription.consumer.email}`,
        subscriptionPausedAlertEmail({
          businessName: business.name,
          memberName: planSubscription.consumer.name || "Member",
          memberEmail: planSubscription.consumer.email,
          planName: planSubscription.plan.name,
          pausedDate: new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          dashboardUrl,
        }),
        business.contactEmail
      );
    }

    // Subscription resumed (paused -> active)
    if (oldStatus === "paused" && (newStatus === "active" || newStatus === "trialing")) {
      await sendBusinessNotification(
        business.id,
        "subscriptionResumed",
        `Subscription Resumed - ${planSubscription.consumer.name || planSubscription.consumer.email}`,
        subscriptionResumedAlertEmail({
          businessName: business.name,
          memberName: planSubscription.consumer.name || "Member",
          memberEmail: planSubscription.consumer.email,
          planName: planSubscription.plan.name,
          dashboardUrl,
        }),
        business.contactEmail
      );
    }
  } catch (error) {
    console.error(`[Webhook] Failed to send status change notification:`, error);
    // Don't throw - notification failure shouldn't fail the webhook
  }
}

/**
 * Send a notification email to all business users who have the given
 * notification type enabled. Falls back to business.contactEmail if
 * no business users are found.
 */
async function sendBusinessNotification(
  businessId: string,
  notificationType: string,
  subject: string,
  html: string,
  fallbackEmail?: string | null
) {
  try {
    const businessUsers = await prisma.businessUser.findMany({
      where: { businessId },
      include: { user: { select: { email: true } } },
    });

    let sentCount = 0;

    if (businessUsers.length > 0) {
      for (const bu of businessUsers) {
        const prefs = (bu.notificationPreferences as any) || {};
        // Default to true if no preferences set (opt-out model)
        const shouldNotify = prefs[notificationType] !== false;

        if (shouldNotify && bu.user.email) {
          try {
            await sendBusinessEmail(bu.user.email, subject, html);
            sentCount++;
          } catch (emailError) {
            console.error(`[Notification] Failed to send to ${bu.user.email}:`, emailError);
          }
        }
      }
    } else if (fallbackEmail) {
      // No business users found, fall back to contactEmail
      await sendBusinessEmail(fallbackEmail, subject, html);
      sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[Notification] Sent "${notificationType}" to ${sentCount} recipient(s)`);
    }
  } catch (error) {
    console.error(`[Notification] Failed to send "${notificationType}":`, error);
  }
}

/**
 * Handle cancellation scheduled (cancelAtPeriodEnd changed from false to true)
 * Sends confirmation to consumer and notification to business owner
 */
async function handleCancellationScheduled(
  planSubscriptionId: string,
  stripeSubscription: Stripe.Subscription
) {
  try {
    const planSubscription = await prisma.planSubscription.findUnique({
      where: { id: planSubscriptionId },
      include: {
        consumer: true,
        plan: {
          include: {
            business: true,
          },
        },
      },
    });

    if (!planSubscription) return;

    const business = planSubscription.plan.business;
    const consumer = planSubscription.consumer;
    const periodEnd = new Date(stripeSubscription.current_period_end * 1000);
    const effectiveDate = periodEnd.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";

    // 1. Send confirmation email to the consumer
    if (consumer.email) {
      try {
        await sendEmail({
          to: consumer.email,
          subject: `Cancellation Confirmed - ${planSubscription.plan.name}`,
          html: cancellationScheduledEmail({
            customerName: consumer.name || "Valued Member",
            planName: planSubscription.plan.name,
            accessUntilDate: effectiveDate,
            businessName: business.name,
          }),
        });
        console.log(`[Webhook] ✉️ Sent cancellation confirmation to ${consumer.email}`);
      } catch (emailError) {
        console.error(`[Webhook] Failed to send consumer cancellation email:`, emailError);
      }
    }

    // 2. Notify business owner(s) who have cancellationScheduled notifications enabled
    await sendBusinessNotification(
      business.id,
      "cancellationScheduled",
      `Cancellation Scheduled - ${consumer.name || consumer.email} (${planSubscription.plan.name})`,
      cancellationScheduledAlertEmail({
        businessName: business.name,
        memberName: consumer.name || "Member",
        memberEmail: consumer.email,
        planName: planSubscription.plan.name,
        effectiveDate,
        dashboardUrl: `${publicAppUrl}/app/${business.slug}/members/${consumer.id}`,
      }),
      business.contactEmail
    );
  } catch (error) {
    console.error(`[Webhook] Failed to handle cancellation scheduled:`, error);
    // Don't throw - notification failure shouldn't fail the webhook
  }
}

