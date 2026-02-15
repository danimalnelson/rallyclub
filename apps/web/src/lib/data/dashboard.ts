import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";
import { formatCurrency } from "@wine-club/ui";

// ── Types ──────────────────────────────────────────────────────

export interface CachedStripeInvoice {
  created: number;
  amountPaid: number;
}

export interface CachedActivityItem {
  id: string;
  type: "new_member" | "cancellation" | "payment" | "failed_payment";
  title: string;
  description: string;
  timestampMs: number;
  metadata?: {
    amount?: number;
    currency?: string;
    planName?: string;
    consumerId?: string;
  };
}

// ── Cached Stripe invoices (5-minute TTL) ──────────────────────

/**
 * Fetches and caches Stripe invoice data.
 * Returns simplified, serializable invoice records.
 * React cache() deduplicates within a single request.
 */
export const getCachedStripeInvoices = cache(
  async (
    stripeAccountId: string | null,
    sinceTimestamp: number
  ): Promise<CachedStripeInvoice[] | null> => {
    if (!stripeAccountId) return null;

    const fetchInvoices = unstable_cache(
      async () => {
        try {
          const stripe = getStripeClient(stripeAccountId);
          const invoices = await stripe.invoices.list({
            limit: 100,
            status: "paid",
            created: { gte: sinceTimestamp },
          });
          return invoices.data.map(
            (inv): CachedStripeInvoice => ({
              created: inv.created,
              amountPaid: inv.amount_paid,
            })
          );
        } catch (error) {
          console.error("Failed to fetch Stripe invoices:", error);
          return null;
        }
      },
      [`stripe-invoices-${stripeAccountId}`],
      { revalidate: 300 }
    );

    return fetchInvoices();
  }
);

// ── Cached activity feed (60-second TTL) ───────────────────────

/**
 * Fetches and caches the activity feed for a business.
 * Returns processed activity items with timestamps as epoch ms
 * (serializable for unstable_cache).
 */
export const getCachedActivityFeed = cache(
  async (businessId: string): Promise<CachedActivityItem[]> => {
    const fetchActivity = unstable_cache(
      async () => {
        const sevenDaysAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        );

        const [newSubs, cancellations, transactions] = await Promise.all([
          prisma.planSubscription.findMany({
            where: {
              plan: { businessId },
              createdAt: { gte: sevenDaysAgo },
            },
            select: {
              id: true,
              createdAt: true,
              consumer: {
                select: { id: true, name: true, email: true },
              },
              plan: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
          prisma.planSubscription.findMany({
            where: {
              plan: { businessId },
              status: "canceled",
              updatedAt: { gte: sevenDaysAgo },
            },
            select: {
              id: true,
              updatedAt: true,
              consumer: {
                select: { id: true, name: true, email: true },
              },
              plan: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
          }),
          prisma.transaction.findMany({
            where: {
              businessId,
              type: "CHARGE",
              createdAt: { gte: sevenDaysAgo },
            },
            select: {
              id: true,
              amount: true,
              currency: true,
              createdAt: true,
              consumer: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);

        // Transform to serializable CachedActivityItem[]
        const items: CachedActivityItem[] = [];

        for (const sub of newSubs) {
          const name =
            sub.consumer.name || sub.consumer.email.split("@")[0];
          items.push({
            id: `sub-new-${sub.id}`,
            type: "new_member",
            title: `${name} joined`,
            description: sub.plan.name,
            timestampMs: sub.createdAt.getTime(),
            metadata: {
              planName: sub.plan.name,
              consumerId: sub.consumer.id,
            },
          });
        }

        for (const sub of cancellations) {
          const name =
            sub.consumer.name || sub.consumer.email.split("@")[0];
          items.push({
            id: `sub-cancel-${sub.id}`,
            type: "cancellation",
            title: `${name} cancelled`,
            description: sub.plan.name,
            timestampMs: sub.updatedAt.getTime(),
            metadata: {
              planName: sub.plan.name,
              consumerId: sub.consumer.id,
            },
          });
        }

        for (const tx of transactions) {
          const name =
            tx.consumer.name || tx.consumer.email.split("@")[0];
          const amount = formatCurrency(tx.amount, tx.currency);
          items.push({
            id: `tx-${tx.id}`,
            type: "payment",
            title: "Payment received",
            description: `${amount} from ${name}`,
            timestampMs: tx.createdAt.getTime(),
            metadata: {
              amount: tx.amount,
              currency: tx.currency,
              consumerId: tx.consumer.id,
            },
          });
        }

        return items
          .sort((a, b) => b.timestampMs - a.timestampMs)
          .slice(0, 8);
      },
      [`activity-feed-${businessId}`],
      { revalidate: 60 }
    );

    return fetchActivity();
  }
);

// ── MRR calculation helper ─────────────────────────────────────

export function calcMrr(
  subs: Array<{
    plan: {
      basePrice: number | null;
      membership: { billingInterval: string };
    };
  }>
): number {
  return subs.reduce((sum, sub) => {
    if (!sub.plan.basePrice) return sum;
    const interval = sub.plan.membership.billingInterval;
    const monthlyAmount =
      interval === "YEAR"
        ? sub.plan.basePrice / 12
        : interval === "WEEK"
          ? sub.plan.basePrice * 4
          : sub.plan.basePrice;
    return sum + monthlyAmount;
  }, 0);
}
