/**
 * Apply Dynamic Prices Cron Job
 * 
 * This script checks for PriceQueueItems that should be applied (effectiveAt <= NOW())
 * and creates the corresponding Stripe Prices and updates plan.stripePriceId.
 * 
 * Should be run daily or hourly via cron job.
 * 
 * Usage: tsx scripts/apply-dynamic-prices.ts
 */

import { PrismaClient } from "@prisma/client";
import { createConnectedPrice, getStripeClient } from "@wine-club/lib";

const prisma = new PrismaClient();

async function applyDynamicPrices() {
  console.log("🔄 Starting dynamic price application...");
  const now = new Date();
  
  try {
    // Find prices that should be applied
    const pendingPrices = await prisma.priceQueueItem.findMany({
      where: {
        applied: false,
        effectiveAt: { lte: now },
      },
      include: {
        plan: {
          include: {
            membership: {
              include: {
                business: true,
              },
            },
          },
        },
      },
    });

    if (pendingPrices.length === 0) {
      console.log("✅ No pending prices to apply");
      return;
    }

    console.log(`📋 Found ${pendingPrices.length} price(s) to apply`);

    for (const queueItem of pendingPrices) {
      const plan = queueItem.plan;
      const business = plan.membership.business;

      try {
        console.log(`\n🔧 Processing: ${plan.name} (${queueItem.effectiveAt.toISOString().slice(0, 7)})`);

        if (!business.stripeAccountId) {
          console.error(`  ❌ Skipping: Business ${business.id} has no Stripe account`);
          continue;
        }

        if (!plan.stripeProductId) {
          console.error(`  ❌ Skipping: Plan ${plan.id} has no Stripe product`);
          continue;
        }

        // Create Stripe Price
        const stripePrice = await createConnectedPrice(
          business.stripeAccountId,
          {
            productId: plan.stripeProductId,
            unitAmount: queueItem.price,
            currency: plan.currency,
            interval: plan.membership.billingInterval.toLowerCase() as "week" | "month" | "year",
            intervalCount: 1,
            nickname: `${plan.name} - ${queueItem.effectiveAt.toISOString().slice(0, 7)}`,
            metadata: {
              planId: plan.id,
              planName: plan.name,
              businessId: business.id,
              membershipId: plan.membershipId,
              effectiveDate: queueItem.effectiveAt.toISOString(),
            },
          }
        );

        console.log(`  ✅ Created Stripe Price: ${stripePrice.id}`);

        // Archive old Stripe Price
        if (plan.stripePriceId) {
          const stripe = getStripeClient(business.stripeAccountId);
          await stripe.prices.update(plan.stripePriceId, {
            active: false,
          });
          console.log(`  📦 Archived old price: ${plan.stripePriceId}`);
        }

        // Update plan with new Stripe Price ID
        await prisma.plan.update({
          where: { id: plan.id },
          data: {
            stripePriceId: stripePrice.id,
          },
        });

        // Mark queue item as applied
        await prisma.priceQueueItem.update({
          where: { id: queueItem.id },
          data: {
            applied: true,
            stripePriceId: stripePrice.id,
          },
        });

        console.log(`  ✅ Applied price for plan: ${plan.name} ($${(queueItem.price / 100).toFixed(2)})`);

        // TODO: Send notification emails to subscribers
        // - Find all active subscribers to this plan
        // - Send "Price has changed" notification
        // This should be implemented in a separate notification service

      } catch (error) {
        console.error(`  ❌ Error applying price for plan ${plan.id}:`, error);
        // Continue with next item instead of failing entirely
        continue;
      }
    }

    console.log(`\n✅ Dynamic price application complete!`);
  } catch (error) {
    console.error("❌ Error in applyDynamicPrices:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the job
applyDynamicPrices()
  .then(() => {
    console.log("🏁 Job completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Job failed:", error);
    process.exit(1);
  });

