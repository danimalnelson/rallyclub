import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import { CopyButton } from "@/components/copy-button";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed, createActivityFromSubscription, createActivityFromTransaction, type ActivityItem } from "@/components/dashboard/ActivityFeed";
import { ActionItems } from "@/components/dashboard/ActionItems";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { getStripeClient } from "@wine-club/lib";
import { Users } from "@/components/icons/Users";
import { Dollar, ChartTrendingDown, CreditCard } from "geist-icons";

export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;

  // Uses React cache() — shared with layout, so only one DB call per request
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Handle non-complete onboarding states
  if (business.status !== "ONBOARDING_COMPLETE") {
    switch (business.status) {
      case "CREATED":
      case "DETAILS_COLLECTED":
        redirect(`/onboarding/details`);
      case "STRIPE_ACCOUNT_CREATED":
      case "STRIPE_ONBOARDING_REQUIRED":
        redirect(`/onboarding/connect?businessId=${business.id}`);
      case "STRIPE_ONBOARDING_IN_PROGRESS":
      case "ONBOARDING_PENDING":
        redirect(`/onboarding/return`);
      case "PENDING_VERIFICATION":
      case "RESTRICTED":
        // Allow limited dashboard access for these states
        break;
      case "FAILED":
      case "ABANDONED":
        redirect(`/onboarding/connect?businessId=${business.id}`);
      case "SUSPENDED":
        break;
      default:
        redirect(`/onboarding`);
    }
  }

  // Date ranges
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

  // ── Batch 1: Core metrics (4 DB queries + Stripe in parallel) ──
  const [
    activeSubscriptions,
    lastMonthSubscriptions,
    weekAgoSubscriptions,
    pastDueCount,
    stripeData,
  ] = await Promise.all([
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId: business.id },
        status: { in: ["active", "trialing"] },
      },
      include: {
        plan: {
          include: {
            membership: { select: { billingInterval: true } },
          },
        },
        consumer: true,
      },
    }),
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId: business.id },
        createdAt: { lt: thisMonthStart },
        OR: [
          { status: { in: ["active", "trialing"] } },
          { status: "canceled", updatedAt: { gt: lastMonthEnd } },
        ],
      },
      include: {
        plan: {
          include: {
            membership: { select: { billingInterval: true } },
          },
        },
      },
    }),
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId: business.id },
        createdAt: { lt: sevenDaysAgo },
        OR: [
          { status: { in: ["active", "trialing"] } },
          { status: "canceled", updatedAt: { gt: sevenDaysAgo } },
        ],
      },
      select: { consumerId: true },
    }),
    prisma.planSubscription.count({
      where: {
        plan: { businessId: business.id },
        status: "past_due",
      },
    }),
    (async () => {
      if (!business.stripeAccountId) return null;
      try {
        const stripe = getStripeClient(business.stripeAccountId);
        return await stripe.invoices.list({
          limit: 100,
          status: "paid",
          created: { gte: Math.floor(twelveMonthsAgo.getTime() / 1000) },
        });
      } catch (error) {
        console.error("Failed to fetch Stripe invoices:", error);
        return null;
      }
    })(),
  ]);

  // ── Batch 2: Counts and alerts (4 DB queries) ──
  const [
    totalMembersResult,
    totalPlans,
    dynamicPricingPlans,
    unresolvedAlerts,
  ] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT ps."consumerId") as count
      FROM "PlanSubscription" ps
      INNER JOIN "Plan" p ON ps."planId" = p.id
      WHERE p."businessId" = ${business.id}
    `,
    prisma.plan.count({
      where: { businessId: business.id },
    }),
    prisma.plan.count({
      where: { businessId: business.id, pricingType: "DYNAMIC" },
    }),
    prisma.businessAlert.findMany({
      where: { businessId: business.id, resolved: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);

  // ── Batch 3: Activity feed (3 DB queries) ──
  const [
    recentNewSubscriptions,
    recentCancellations,
    recentTransactions,
  ] = await Promise.all([
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId: business.id },
        createdAt: { gte: sevenDaysAgo },
      },
      include: { consumer: true, plan: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId: business.id },
        status: "canceled",
        updatedAt: { gte: sevenDaysAgo },
      },
      include: { consumer: true, plan: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: {
        businessId: business.id,
        type: "CHARGE",
        createdAt: { gte: sevenDaysAgo },
      },
      include: { consumer: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  // ── Compute metrics from parallel results ──

  // MRR calculation
  const calcMrr = (subs: Array<{ plan: { basePrice: number | null; membership: { billingInterval: string } } }>) =>
    subs.reduce((sum, sub) => {
      if (!sub.plan.basePrice) return sum;
      const interval = sub.plan.membership.billingInterval;
      const monthlyAmount = interval === "YEAR"
        ? sub.plan.basePrice / 12
        : interval === "WEEK"
        ? sub.plan.basePrice * 4
        : sub.plan.basePrice;
      return sum + monthlyAmount;
    }, 0);

  const currentMrr = calcMrr(activeSubscriptions);
  const lastMonthMrr = calcMrr(lastMonthSubscriptions);
  const mrrTrendPercent = lastMonthMrr > 0
    ? ((currentMrr - lastMonthMrr) / lastMonthMrr) * 100
    : currentMrr > 0 ? 100 : 0;

  // Member metrics
  const activeMembers = new Set(activeSubscriptions.map(s => s.consumerId)).size;
  const weekAgoMembers = new Set(weekAgoSubscriptions.map(s => s.consumerId)).size;
  const membersTrendPercent = weekAgoMembers > 0
    ? ((activeMembers - weekAgoMembers) / weekAgoMembers) * 100
    : activeMembers > 0 ? 100 : 0;

  const totalMembers = Number(totalMembersResult[0]?.count ?? 0);

  // Stripe revenue
  let thisMonthRevenue = 0;
  let monthlyRevenue: Array<{ month: string; revenue: number }> = [];
  let mrrHistory: Array<{ month: string; mrr: number }> = [];

  if (stripeData) {
    const monthlyRevenueMap = new Map<string, number>();

    for (const invoice of stripeData.data) {
      const date = new Date(invoice.created * 1000);
      const monthKey = date.toISOString().slice(0, 7);
      monthlyRevenueMap.set(
        monthKey,
        (monthlyRevenueMap.get(monthKey) || 0) + invoice.amount_paid
      );
      if (date >= thisMonthStart) {
        thisMonthRevenue += invoice.amount_paid;
      }
    }

    monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    const lastMonthRevenueValue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
    mrrHistory = monthlyRevenue.map(({ month, revenue }) => ({
      month,
      mrr: lastMonthRevenueValue > 0
        ? Math.round((revenue / lastMonthRevenueValue) * currentMrr)
        : currentMrr,
    }));
  }

  // Alert counts
  const missingPriceAlerts = unresolvedAlerts.filter(
    (a) => a.type === "MISSING_DYNAMIC_PRICE"
  ).length;

  // Activity feed
  const activities: ActivityItem[] = [
    ...recentNewSubscriptions.map((sub) =>
      createActivityFromSubscription(sub, "new")
    ),
    ...recentCancellations.map((sub) =>
      createActivityFromSubscription(sub, "cancelled")
    ),
    ...recentTransactions.map((tx) => createActivityFromTransaction(tx)),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 8);

  const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="max-w-7xl mx-auto">
        {/* Status Banners for non-complete states */}
        {business.status === "PENDING_VERIFICATION" && (
          <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">⏳</span>
                Account Verification in Progress
              </CardTitle>
              <CardDescription>
                Your Stripe account is being verified. This usually takes a few minutes to 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Link href="/onboarding/return">
                  <Button>
                    Check Status
                  </Button>
                </Link>
                <a 
                  href={`https://dashboard.stripe.com/${business.stripeAccountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
                >
                  Open Stripe Dashboard
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {business.status === "RESTRICTED" && (
          <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                Action Required: Complete Verification
              </CardTitle>
              <CardDescription>
                Your Stripe account requires additional information to process payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/onboarding/return">
                <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                  Complete Requirements
                </button>
              </Link>
            </CardContent>
          </Card>
        )}

        {business.status === "SUSPENDED" && (
          <Card className="mb-6 border-red-600 bg-red-100 dark:bg-red-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
                <span className="text-2xl">🚫</span>
                Account Suspended
              </CardTitle>
              <CardDescription className="text-red-800 dark:text-red-200">
                Your account has been suspended. Please contact support.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Alert Banner for unresolved alerts */}
        <AlertBanner alerts={unresolvedAlerts} businessId={business.id} businessSlug={business.slug} />

        {/* Getting Started (only shows if not complete) */}
        <div className="mb-6">
          <GettingStarted
            businessId={business.id}
            businessSlug={business.slug}
            stripeConnected={!!business.stripeAccountId}
            hasPlans={totalPlans > 0}
            hasMembers={totalMembers > 0}
            />
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            title="Monthly Recurring Revenue"
            value={formatCurrency(Math.round(currentMrr), business.currency)}
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
            href={`/app/${business.slug}/members`}
          />
          <MetricCard
            title="Failed Payments"
            value={pastDueCount}
            description={pastDueCount > 0 ? "Needs attention" : "All good"}
            icon={<CreditCard className="h-4 w-4" />}
            href={pastDueCount > 0 ? `/app/${business.slug}/members?status=past_due` : undefined}
          />
          <MetricCard
            title="Revenue This Month"
            value={formatCurrency(thisMonthRevenue, business.currency)}
            description={new Date().toLocaleDateString("en-US", { month: "long" })}
            icon={<ChartTrendingDown className="h-4 w-4" />}
            href={`/app/${business.slug}/transactions`}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Activity */}
          <ActivityFeed
            activities={activities}
            businessId={business.id}
            businessSlug={business.slug}
            maxItems={6}
          />

          {/* Action Items */}
          <ActionItems
            businessId={business.id}
            businessSlug={business.slug}
            totalPlans={totalPlans}
            totalMembers={totalMembers}
            failedPayments={pastDueCount}
            unresolvedAlerts={unresolvedAlerts.length}
            hasDynamicPricing={dynamicPricingPlans > 0}
            missingPriceCount={missingPriceAlerts}
          />
        </div>

        {/* Revenue Charts */}
        <div className="mb-6">
          <RevenueChart
            monthlyRevenue={monthlyRevenue}
            mrrHistory={mrrHistory}
            currency={business.currency}
          />
        </div>

        {/* Public Page Card */}
        <Card>
          <CardHeader>
            <CardTitle>Public Page</CardTitle>
            <CardDescription>
              Share this link with potential members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={`${publicAppUrl}/${business.slug}`}
                readOnly
                className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm font-mono"
              />
              <CopyButton
                text={`${publicAppUrl}/${business.slug}`}
                className="px-4 py-2 border rounded-md hover:bg-accent"
              />
            </div>
            <div className="flex gap-4">
              <a
                href={`${publicAppUrl}/${business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Preview page →
              </a>
              <Link
                href={`/app/${business.slug}/settings`}
                className="text-sm text-muted-foreground hover:underline"
              >
                Customize
              </Link>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
