import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import { CopyButton } from "@/components/copy-button";
import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityFeed, createActivityFromSubscription, createActivityFromTransaction, type ActivityItem } from "@/components/dashboard/ActivityFeed";
import { ActionItems } from "@/components/dashboard/ActionItems";
import { GettingStarted } from "@/components/dashboard/GettingStarted";
import { AlertBanner } from "@/components/dashboard/AlertBanner";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { Users, DollarSign, TrendingDown, CreditCard } from "lucide-react";

export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessId } = await params;
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      users: {
        where: {
          userId: session.user.id,
        },
      },
    },
  });

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
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get active subscriptions with plan info
  const activeSubscriptions = await prisma.planSubscription.findMany({
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
  });

  // Calculate current MRR
  const currentMrr = activeSubscriptions.reduce((sum, sub) => {
    if (!sub.plan.basePrice) return sum;
    const interval = sub.plan.membership.billingInterval;
    const monthlyAmount = interval === "YEAR"
      ? sub.plan.basePrice / 12
      : interval === "WEEK"
      ? sub.plan.basePrice * 4
      : sub.plan.basePrice;
    return sum + monthlyAmount;
  }, 0);

  // Get last month MRR for comparison
  const lastMonthSubscriptions = await prisma.planSubscription.findMany({
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
  });

  const lastMonthMrr = lastMonthSubscriptions.reduce((sum, sub) => {
    if (!sub.plan.basePrice) return sum;
    const interval = sub.plan.membership.billingInterval;
    const monthlyAmount = interval === "YEAR"
      ? sub.plan.basePrice / 12
      : interval === "WEEK"
      ? sub.plan.basePrice * 4
      : sub.plan.basePrice;
    return sum + monthlyAmount;
  }, 0);

  // Calculate MRR trend
  const mrrTrendPercent = lastMonthMrr > 0 
    ? ((currentMrr - lastMonthMrr) / lastMonthMrr) * 100 
    : currentMrr > 0 ? 100 : 0;

  // Count unique active members
  const activeMembers = new Set(activeSubscriptions.map(s => s.consumerId)).size;

  // Get member count from one week ago
  const weekAgoSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId: business.id },
      createdAt: { lt: sevenDaysAgo },
      OR: [
        { status: { in: ["active", "trialing"] } },
        { status: "canceled", updatedAt: { gt: sevenDaysAgo } },
      ],
    },
    select: { consumerId: true },
  });
  const weekAgoMembers = new Set(weekAgoSubscriptions.map(s => s.consumerId)).size;
  const membersTrendPercent = weekAgoMembers > 0 
    ? ((activeMembers - weekAgoMembers) / weekAgoMembers) * 100 
    : activeMembers > 0 ? 100 : 0;

  // Get failed payments (past due)
  const pastDueCount = await prisma.planSubscription.count({
    where: {
      plan: { businessId: business.id },
      status: "past_due",
    },
  });

  // Get this month's revenue
  const thisMonthRevenueResult = await prisma.transaction.aggregate({
    where: {
      businessId: business.id,
      type: "CHARGE",
      createdAt: { gte: thisMonthStart },
    },
    _sum: { amount: true },
  });
  const thisMonthRevenue = thisMonthRevenueResult._sum.amount || 0;

  // Get total members (all time)
  const allSubscriptions = await prisma.planSubscription.findMany({
    where: { plan: { businessId: business.id } },
    select: { consumerId: true },
  });
  const totalMembers = new Set(allSubscriptions.map(s => s.consumerId)).size;

  // Get total plans
  const totalPlans = await prisma.plan.count({
    where: { businessId: business.id },
  });

  // Check for dynamic pricing plans
  const dynamicPricingPlans = await prisma.plan.count({
    where: { businessId: business.id, pricingType: "DYNAMIC" },
  });

  // Get unresolved alerts
  const unresolvedAlerts = await prisma.businessAlert.findMany({
    where: { businessId: business.id, resolved: false },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  // Count missing price alerts
  const missingPriceAlerts = unresolvedAlerts.filter(
    (a) => a.type === "MISSING_DYNAMIC_PRICE"
  ).length;

  // Get recent activity data
  const recentNewSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId: business.id },
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      consumer: true,
      plan: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentCancellations = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId: business.id },
      status: "canceled",
      updatedAt: { gte: sevenDaysAgo },
    },
    include: {
      consumer: true,
      plan: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  const recentTransactions = await prisma.transaction.findMany({
    where: {
      businessId: business.id,
      type: "CHARGE",
      createdAt: { gte: sevenDaysAgo },
    },
    include: {
      consumer: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  // Get monthly revenue for charts (last 6 months)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const monthlyTransactions = await prisma.transaction.findMany({
    where: {
      businessId: business.id,
      type: "CHARGE",
      createdAt: { gte: sixMonthsAgo },
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group transactions by month
  const monthlyRevenueMap = new Map<string, number>();
  monthlyTransactions.forEach(tx => {
    const monthKey = tx.createdAt.toISOString().slice(0, 7);
    monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + tx.amount);
  });

  const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .slice(-6);

  // Generate MRR history from monthly revenue
  const lastMonthRevenueValue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
  const mrrHistory = monthlyRevenue.map(({ month, revenue }) => ({
    month,
    mrr: lastMonthRevenueValue > 0 
      ? Math.round((revenue / lastMonthRevenueValue) * currentMrr)
      : currentMrr,
  }));

  // Build activity feed
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
    <div className="min-h-screen bg-background">
      <DashboardHeader 
        business={business} 
        userEmail={session.user.email || undefined}
      />

      <main className="container mx-auto px-4 py-8">
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
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                    Check Status
                  </button>
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
        <AlertBanner alerts={unresolvedAlerts} businessId={business.id} />

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
            icon={<DollarSign className="h-4 w-4" />}
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
            href={`/app/${business.id}/members`}
          />
          <MetricCard
            title="Failed Payments"
            value={pastDueCount}
            description={pastDueCount > 0 ? "Needs attention" : "All good"}
            icon={<CreditCard className="h-4 w-4" />}
            href={pastDueCount > 0 ? `/app/${business.id}/members?status=past_due` : undefined}
          />
          <MetricCard
            title="Revenue This Month"
            value={formatCurrency(thisMonthRevenue, business.currency)}
            description={new Date().toLocaleDateString("en-US", { month: "long" })}
            icon={<TrendingDown className="h-4 w-4" />}
            href={`/app/${business.id}/transactions`}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Activity */}
          <ActivityFeed
            activities={activities}
            businessId={business.id}
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
                href={`/app/${business.id}/settings`}
                className="text-sm text-muted-foreground hover:underline"
              >
                Customize
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
