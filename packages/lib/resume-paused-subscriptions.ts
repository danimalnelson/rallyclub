/**
 * Resume Paused Subscriptions
 * 
 * When a business owner adds a price for a dynamic plan after billing dates
 * have passed, this function resumes all paused subscriptions and charges
 * customers immediately.
 * 
 * Called from: Plan edit API route when dynamic price is updated
 */

import { PrismaClient } from "@prisma/client";
import { getStripeClient } from "./stripe";

const prisma = new PrismaClient();

interface ResumeResult {
  resumed: number;
  charged: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

export async function resumePausedSubscriptions(
  planId: string,
  stripePriceId: string,
  stripeAccountId: string
): Promise<ResumeResult> {
  const result: ResumeResult = {
    resumed: 0,
    charged: 0,
    errors: [],
  };

  try {
    // Find all paused subscriptions for this plan
    const pausedSubscriptions = await prisma.planSubscription.findMany({
      where: {
        planId,
        pausedAt: {
          not: null,
        },
      },
      include: {
        consumer: true,
        plan: {
          include: {
            business: true,
            membership: true,
          },
        },
      },
    });

    if (pausedSubscriptions.length === 0) {
      console.log(`[Resume] No paused subscriptions found for plan ${planId}`);
      return result;
    }

    console.log(`[Resume] Found ${pausedSubscriptions.length} paused subscription(s)`);

    const stripe = getStripeClient(stripeAccountId);

    for (const planSub of pausedSubscriptions) {
      try {
        // Get current Stripe subscription
        const stripeSubscription = await stripe.subscriptions.retrieve(
          planSub.stripeSubscriptionId
        );

        // Check if it's actually paused
        if (!stripeSubscription.pause_collection) {
          console.log(`[Resume] Subscription ${planSub.id} not paused in Stripe, skipping`);
          
          // Clean up database state
          await prisma.planSubscription.update({
            where: { id: planSub.id },
            data: { pausedAt: null },
          });
          
          continue;
        }

        console.log(`[Resume] Resuming subscription ${planSub.stripeSubscriptionId}...`);

        // Update subscription: Remove pause and update price
        const updatedSubscription = await stripe.subscriptions.update(
          planSub.stripeSubscriptionId,
          {
            pause_collection: null, // Remove pause
            items: [
              {
                id: stripeSubscription.items.data[0].id,
                price: stripePriceId,
              },
            ],
            proration_behavior: "none", // Don't prorate, charge full amount
            metadata: {
              ...stripeSubscription.metadata,
              resumedAt: new Date().toISOString(),
              resumedBySystem: "true",
              resumeReason: "PRICE_ADDED",
            },
          }
        );

        result.resumed++;
        console.log(`[Resume] ✅ Resumed: ${planSub.stripeSubscriptionId}`);

        // Create an invoice immediately to charge the customer
        const invoice = await stripe.invoices.create({
          customer: planSub.stripeCustomerId,
          subscription: planSub.stripeSubscriptionId,
          auto_advance: true, // Automatically finalize and charge
        });

        // Finalize the invoice (this triggers the charge)
        await stripe.invoices.finalizeInvoice(invoice.id);

        result.charged++;
        console.log(`[Resume] 💳 Charged: ${invoice.id} ($${(invoice.amount_due / 100).toFixed(2)})`);

        // Update PlanSubscription in database
        await prisma.planSubscription.update({
          where: { id: planSub.id },
          data: {
            pausedAt: null,
            // Status will be updated via webhook
          },
        });

        // Resolve SUBSCRIPTION_PAUSED alerts for this subscription
        await prisma.businessAlert.updateMany({
          where: {
            businessId: planSub.plan.businessId,
            type: "SUBSCRIPTION_PAUSED",
            resolved: false,
            metadata: {
              path: ["subscriptionId"],
              equals: planSub.id,
            },
          },
          data: {
            resolved: true,
            resolvedAt: new Date(),
          },
        });

        console.log(`[Resume] ✅ Resolved alerts for subscription ${planSub.id}`);

      } catch (error: any) {
        console.error(`[Resume] ❌ Failed to resume subscription ${planSub.id}:`, error);
        result.errors.push({
          subscriptionId: planSub.id,
          error: error.message || "Unknown error",
        });
      }
    }

    console.log(`[Resume] Complete: ${result.resumed} resumed, ${result.charged} charged, ${result.errors.length} errors`);

    return result;
  } catch (error) {
    console.error("[Resume] Fatal error:", error);
    throw error;
  }
}

