import type { PrismaClient } from "@prisma/client";
import { MEMBER_STATUS, SUBSCRIPTION_STATUS, PRICE_INTERVAL } from "./constants";

/**
 * Trend data showing change over time
 */
export interface TrendData {
  /** Current value */
  current: number;
  /** Previous value (for comparison) */
  previous: number;
  /** Percentage change ((current - previous) / previous * 100) */
  percentChange: number;
  /** Label describing the comparison period */
  label: string;
}

/**
 * Business performance metrics for dashboard display.
 * All monetary values are in cents to avoid floating-point precision issues.
 */
export interface BusinessMetrics {
  /** Monthly Recurring Revenue in cents */
  mrr: number;
  /** Current count of active members */
  activeMembers: number;
  /** Churn rate as a percentage (0-100) calculated over last 30 days */
  churnRate: number;
  /** All-time total revenue in cents */
  totalRevenue: number;
  /** Revenue breakdown by month for charting (last 12 months) */
  monthlyRevenue: Array<{ month: string; revenue: number }>;
}

/**
 * Extended metrics including trend calculations for dashboard display
 */
export interface DashboardMetrics extends BusinessMetrics {
  /** MRR trend vs last month */
  mrrTrend: TrendData;
  /** Active members trend vs last week */
  membersTrend: TrendData;
  /** This month's revenue so far */
  thisMonthRevenue: number;
}

/**
 * Calculates comprehensive business metrics for a given business.
 * 
 * Aggregates data from members, subscriptions, and payments to provide:
 * - MRR (Monthly Recurring Revenue) from active subscriptions
 * - Active member count
 * - 30-day churn rate
 * - All-time total revenue
 * - Monthly revenue breakdown (last 12 months)
 * 
 * This function performs multiple database queries and should be cached
 * when possible to avoid performance impacts.
 * 
 * @param prisma - Prisma client instance
 * @param businessId - ID of the business to calculate metrics for
 * @returns Promise resolving to BusinessMetrics object
 * 
 * @example
 * const metrics = await calculateMetrics(prisma, 'biz_123');
 * console.log(`MRR: $${metrics.mrr / 100}`);
 * console.log(`Active Members: ${metrics.activeMembers}`);
 * console.log(`Churn Rate: ${metrics.churnRate}%`);
 */
export async function calculateMetrics(
  prisma: PrismaClient,
  businessId: string
): Promise<BusinessMetrics> {
  // Get active members count
  const activeMembers = await prisma.member.count({
    where: {
      businessId,
      status: MEMBER_STATUS.ACTIVE,
    },
  });

  // Calculate MRR from active subscriptions
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      member: {
        businessId,
      },
      status: {
        in: [SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.TRIALING],
      },
    },
    include: {
      price: true,
    },
  });

  let mrr = 0;
  for (const sub of activeSubscriptions) {
    const amount = sub.price.unitAmount;
    if (sub.price.interval === PRICE_INTERVAL.MONTH) {
      mrr += amount;
    } else if (sub.price.interval === PRICE_INTERVAL.YEAR) {
      mrr += Math.floor(amount / 12); // Convert yearly to monthly
    }
  }

  // Calculate churn rate (canceled in last 30 days / total active 30 days ago)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const canceledMembers = await prisma.member.count({
    where: {
      businessId,
      status: MEMBER_STATUS.CANCELED,
      updatedAt: {
        gte: thirtyDaysAgo,
      },
    },
  });

  const totalMembersThirtyDaysAgo = activeMembers + canceledMembers;
  const churnRate =
    totalMembersThirtyDaysAgo > 0
      ? (canceledMembers / totalMembersThirtyDaysAgo) * 100
      : 0;

  // Calculate total revenue
  const totalRevenue = await prisma.transaction.aggregate({
    where: {
      businessId,
      type: "CHARGE",
    },
    _sum: {
      amount: true,
    },
  });

  // Get monthly revenue for last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyTransactions = await prisma.transaction.findMany({
    where: {
      businessId,
      type: "CHARGE",
      createdAt: {
        gte: sixMonthsAgo,
      },
    },
    select: {
      amount: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Group by month
  const monthlyRevenueMap = new Map<string, number>();
  for (const tx of monthlyTransactions) {
    const monthKey = tx.createdAt.toISOString().slice(0, 7); // YYYY-MM
    monthlyRevenueMap.set(
      monthKey,
      (monthlyRevenueMap.get(monthKey) || 0) + tx.amount
    );
  }

  const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .slice(-6); // Last 6 months

  return {
    mrr,
    activeMembers,
    churnRate: Math.round(churnRate * 100) / 100, // Round to 2 decimal places
    totalRevenue: totalRevenue._sum.amount || 0,
    monthlyRevenue,
  };
}

/**
 * Calculate trend percentage between two values
 */
function calculateTrend(current: number, previous: number, label: string): TrendData {
  const percentChange = previous > 0 
    ? ((current - previous) / previous) * 100 
    : current > 0 ? 100 : 0;

  return {
    current,
    previous,
    percentChange: Math.round(percentChange * 10) / 10, // Round to 1 decimal
    label,
  };
}

/**
 * Calculates dashboard metrics including trends for display.
 * Uses PlanSubscription model for accurate member/MRR calculations.
 * 
 * @param prisma - Prisma client instance
 * @param businessId - ID of the business
 * @returns Promise resolving to DashboardMetrics with trends
 */
export async function calculateDashboardMetrics(
  prisma: PrismaClient,
  businessId: string
): Promise<DashboardMetrics> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get current active subscriptions with plan info
  const activeSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId },
      status: { in: ["active", "trialing"] },
    },
    include: {
      plan: {
        include: {
          membership: { select: { billingInterval: true } },
        },
      },
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

  // Get subscriptions from last month for MRR comparison
  const lastMonthSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId },
      status: { in: ["active", "trialing"] },
      createdAt: { lt: thisMonthStart },
    },
    include: {
      plan: {
        include: {
          membership: { select: { billingInterval: true } },
        },
      },
    },
  });

  // Filter to only those that were active last month (not cancelled before month end)
  const lastMonthMrr = lastMonthSubscriptions
    .filter(sub => {
      // Include if not cancelled, or cancelled after last month
      if (sub.status !== "canceled") return true;
      return sub.updatedAt > lastMonthEnd;
    })
    .reduce((sum, sub) => {
      if (!sub.plan.basePrice) return sum;
      const interval = sub.plan.membership.billingInterval;
      const monthlyAmount = interval === "YEAR"
        ? sub.plan.basePrice / 12
        : interval === "WEEK"
        ? sub.plan.basePrice * 4
        : sub.plan.basePrice;
      return sum + monthlyAmount;
    }, 0);

  // Count unique active members
  const activeMembers = new Set(activeSubscriptions.map(s => s.consumerId)).size;

  // Get member count from one week ago
  const weekAgoSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: { businessId },
      createdAt: { lt: oneWeekAgo },
      OR: [
        { status: { in: ["active", "trialing"] } },
        { 
          status: "canceled",
          updatedAt: { gt: oneWeekAgo },
        },
      ],
    },
    select: { consumerId: true },
  });
  const weekAgoMembers = new Set(weekAgoSubscriptions.map(s => s.consumerId)).size;

  // Calculate churn rate (30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const cancelledInPeriod = await prisma.planSubscription.count({
    where: {
      plan: { businessId },
      status: "canceled",
      updatedAt: { gte: thirtyDaysAgo },
    },
  });
  const totalAtStart = activeMembers + cancelledInPeriod;
  const churnRate = totalAtStart > 0 ? (cancelledInPeriod / totalAtStart) * 100 : 0;

  // Get total revenue
  const totalRevenueResult = await prisma.transaction.aggregate({
    where: { businessId, type: "CHARGE" },
    _sum: { amount: true },
  });
  const totalRevenue = totalRevenueResult._sum.amount || 0;

  // Get this month's revenue
  const thisMonthRevenueResult = await prisma.transaction.aggregate({
    where: {
      businessId,
      type: "CHARGE",
      createdAt: { gte: thisMonthStart },
    },
    _sum: { amount: true },
  });
  const thisMonthRevenue = thisMonthRevenueResult._sum.amount || 0;

  // Get monthly revenue for chart
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const monthlyTransactions = await prisma.transaction.findMany({
    where: {
      businessId,
      type: "CHARGE",
      createdAt: { gte: sixMonthsAgo },
    },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const monthlyRevenueMap = new Map<string, number>();
  monthlyTransactions.forEach(tx => {
    const monthKey = tx.createdAt.toISOString().slice(0, 7);
    monthlyRevenueMap.set(monthKey, (monthlyRevenueMap.get(monthKey) || 0) + tx.amount);
  });

  const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .slice(-6);

  return {
    mrr: Math.round(currentMrr),
    mrrTrend: calculateTrend(currentMrr, lastMonthMrr, "vs last month"),
    activeMembers,
    membersTrend: calculateTrend(activeMembers, weekAgoMembers, "vs last week"),
    churnRate: Math.round(churnRate * 100) / 100,
    totalRevenue,
    thisMonthRevenue,
    monthlyRevenue,
  };
}

