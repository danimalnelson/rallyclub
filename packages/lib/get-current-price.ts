/**
 * Get Current Price for Dynamic Plans
 * 
 * Determines the correct Stripe Price ID for a dynamic pricing plan
 * based on the current date (or provided date).
 * 
 * Logic:
 * - Looks for applied PriceQueueItem where effectiveAt is in the current month
 * - Returns the stripePriceId from that queue item
 * - Returns null if no price found for current month
 * 
 * This ensures:
 * - June signups get June price
 * - July signups get July price (even if July price was set in June)
 * - Billing in July uses July price (not June fallback)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getCurrentPriceForDate(
  planId: string,
  date: Date = new Date()
): Promise<string | null> {
  // Get boundaries of current month
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfNextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  startOfNextMonth.setHours(0, 0, 0, 0);

  console.log(`[getCurrentPrice] Looking for price for ${date.toISOString().slice(0, 10)}`);
  console.log(`[getCurrentPrice] Month range: ${startOfMonth.toISOString().slice(0, 10)} to ${startOfNextMonth.toISOString().slice(0, 10)}`);

  // Find price for THIS specific month
  const priceForMonth = await prisma.priceQueueItem.findFirst({
    where: {
      planId,
      applied: true,
      effectiveAt: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    },
    orderBy: {
      effectiveAt: "desc", // Get latest if multiple prices in same month
    },
  });

  if (!priceForMonth?.stripePriceId) {
    console.log(
      `[getCurrentPrice] ❌ No price found for ${date.toISOString().slice(0, 7)}`
    );
    return null;
  }

  console.log(
    `[getCurrentPrice] ✅ Found price for ${date.toISOString().slice(0, 7)}: ${priceForMonth.stripePriceId} ($${(priceForMonth.price / 100).toFixed(2)})`
  );

  return priceForMonth.stripePriceId;
}

/**
 * Helper: Get price for a plan (works for both FIXED and DYNAMIC)
 */
export async function getPriceForPlan(
  planId: string,
  date: Date = new Date()
): Promise<string | null> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    return null;
  }

  if (plan.pricingType === "FIXED") {
    // Fixed pricing: use plan's stripePriceId
    return plan.stripePriceId;
  } else {
    // Dynamic pricing: look up current month's price
    return getCurrentPriceForDate(planId, date);
  }
}

