import { prisma } from "@wine-club/db";
import { formatCurrency } from "@wine-club/ui";
import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  ActivityFeed,
  type ActivityItem,
} from "@/components/dashboard/ActivityFeed";
import { ActionItems } from "@/components/dashboard/ActionItems";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { Users } from "@/components/icons/Users";
import { Dollar, ChartTrendingDown, CreditCard } from "geist-icons";
import {
  getCachedStripeInvoices,
  getCachedActivityFeed,
  calcMrr,
} from "@/lib/data/dashboard";

interface DashboardContentProps {
  businessId: string;
  businessSlug: string;
  businessCurrency: string;
  stripeAccountId: string | null;
}

export async function DashboardContent({
  businessId,
  businessSlug,
  businessCurrency,
  stripeAccountId,
}: DashboardContentProps) {
  // Date ranges
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const twelveMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 12,
    1
  );

  // ── ALL queries in ONE parallel Promise.all (Steps A + C + D + F) ──
  const [
    activeSubscriptions,
    lastMonthSubscriptions,
    weekAgoSubscriptions,
    pastDueCount,
    totalMembersResult,
    totalPlans,
    dynamicPricingPlans,
    unresolvedAlerts,
    stripeInvoices,
    cachedActivities,
  ] = await Promise.all([
    // 1. Active subscriptions — optimized select (Step F):
    //    only consumerId (for member count) + plan pricing (for MRR)
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId },
        status: { in: ["active", "trialing"] },
      },
      select: {
        consumerId: true,
        plan: {
          select: {
            basePrice: true,
            membership: { select: { billingInterval: true } },
          },
        },
      },
    }),

    // 2. Last month subscriptions — for MRR trend (optimized select)
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId },
        createdAt: { lt: thisMonthStart },
        OR: [
          { status: { in: ["active", "trialing"] } },
          { status: "canceled", updatedAt: { gt: lastMonthEnd } },
        ],
      },
      select: {
        plan: {
          select: {
            basePrice: true,
            membership: { select: { billingInterval: true } },
          },
        },
      },
    }),

    // 3. Week-ago subscriptions — for member trend
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId },
        createdAt: { lt: sevenDaysAgo },
        OR: [
          { status: { in: ["active", "trialing"] } },
          { status: "canceled", updatedAt: { gt: sevenDaysAgo } },
        ],
      },
      select: { consumerId: true },
    }),

    // 4. Past-due count
    prisma.planSubscription.count({
      where: {
        plan: { businessId },
        status: "past_due",
      },
    }),

    // 5. Total unique members (raw SQL for distinct count)
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT ps."consumerId") as count
      FROM "plan_subscriptions" ps
      INNER JOIN "plans" p ON ps."planId" = p.id
      WHERE p."businessId" = ${businessId}
    `,

    // 6. Total plans count
    prisma.plan.count({
      where: { businessId },
    }),

    // 7. Dynamic pricing plans count
    prisma.plan.count({
      where: { businessId, pricingType: "DYNAMIC" },
    }),

    // 8. Unresolved alerts
    prisma.businessAlert.findMany({
      where: { businessId, resolved: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),

    // 9. Cached Stripe invoices (5-min TTL) — for "Revenue This Month"
    getCachedStripeInvoices(
      stripeAccountId,
      Math.floor(twelveMonthsAgo.getTime() / 1000)
    ),

    // 10. Cached activity feed (60s TTL)
    getCachedActivityFeed(businessId),
  ]);

  // ── Compute metrics ──

  const currentMrr = calcMrr(activeSubscriptions);
  const lastMonthMrr = calcMrr(lastMonthSubscriptions);
  const mrrTrendPercent =
    lastMonthMrr > 0
      ? ((currentMrr - lastMonthMrr) / lastMonthMrr) * 100
      : currentMrr > 0
        ? 100
        : 0;

  const activeMembers = new Set(
    activeSubscriptions.map((s) => s.consumerId)
  ).size;
  const weekAgoMembers = new Set(
    weekAgoSubscriptions.map((s) => s.consumerId)
  ).size;
  const membersTrendPercent =
    weekAgoMembers > 0
      ? ((activeMembers - weekAgoMembers) / weekAgoMembers) * 100
      : activeMembers > 0
        ? 100
        : 0;

  const totalMembers = Number(totalMembersResult[0]?.count ?? 0);

  // Revenue this month from cached Stripe data
  let thisMonthRevenue = 0;
  if (stripeInvoices) {
    for (const inv of stripeInvoices) {
      const date = new Date(inv.created * 1000);
      if (date >= thisMonthStart) {
        thisMonthRevenue += inv.amountPaid;
      }
    }
  }

  // Alert counts
  const missingPriceAlerts = unresolvedAlerts.filter(
    (a) => a.type === "MISSING_DYNAMIC_PRICE"
  ).length;

  // Convert cached activities to ActivityItem[] (restore Date objects)
  const activities: ActivityItem[] = cachedActivities.map((item) => ({
    ...item,
    timestamp: new Date(item.timestampMs),
  }));

  return (
    <>
      {/* Alert Banner for unresolved alerts */}
      <AlertBanner
        alerts={unresolvedAlerts}
        businessId={businessId}
        businessSlug={businessSlug}
      />

      {/* Getting Started (only shows if not complete) */}
      <div className="mb-6">
        <GettingStarted
          businessId={businessId}
          businessSlug={businessSlug}
          stripeConnected={!!stripeAccountId}
          hasPlans={totalPlans > 0}
          hasMembers={totalMembers > 0}
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard
          title="Monthly Recurring Revenue"
          value={formatCurrency(
            Math.round(currentMrr),
            businessCurrency
          )}
          trend={{
            value: Math.round(mrrTrendPercent * 10) / 10,
            label: "vs last month",
          }}
          icon={<Dollar className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Members"
          value={activeMembers}
          description={`${totalMembers} total`}
          trend={{
            value: Math.round(membersTrendPercent * 10) / 10,
            label: "vs last week",
          }}
          icon={<Users className="h-4 w-4" />}
          href={`/app/${businessSlug}/members`}
        />
        <MetricCard
          title="Failed Payments"
          value={pastDueCount}
          description={pastDueCount > 0 ? "Needs attention" : "All good"}
          icon={<CreditCard className="h-4 w-4" />}
          href={
            pastDueCount > 0
              ? `/app/${businessSlug}/members?status=past_due`
              : undefined
          }
        />
        <MetricCard
          title="Revenue This Month"
          value={formatCurrency(thisMonthRevenue, businessCurrency)}
          description={new Date().toLocaleDateString("en-US", {
            month: "long",
          })}
          icon={<ChartTrendingDown className="h-4 w-4" />}
          href={`/app/${businessSlug}/transactions`}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Activity */}
        <ActivityFeed
          activities={activities}
          businessId={businessId}
          businessSlug={businessSlug}
          maxItems={6}
        />

        {/* Action Items */}
        <ActionItems
          businessId={businessId}
          businessSlug={businessSlug}
          totalPlans={totalPlans}
          totalMembers={totalMembers}
          failedPayments={pastDueCount}
          unresolvedAlerts={unresolvedAlerts.length}
          hasDynamicPricing={dynamicPricingPlans > 0}
          missingPriceCount={missingPriceAlerts}
        />
      </div>
    </>
  );
}
