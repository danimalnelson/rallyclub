import { prisma } from "@wine-club/db";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { getCachedStripeInvoices, calcMrr } from "@/lib/data/dashboard";

interface DashboardRevenueProps {
  businessId: string;
  businessCurrency: string;
  stripeAccountId: string | null;
}

export async function DashboardRevenue({
  businessId,
  businessCurrency,
  stripeAccountId,
}: DashboardRevenueProps) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const twelveMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 12,
    1
  );

  // Fetch Stripe data (cached, 5-min TTL) + MRR subscriptions in parallel
  const [stripeInvoices, mrrSubs] = await Promise.all([
    getCachedStripeInvoices(
      stripeAccountId,
      Math.floor(twelveMonthsAgo.getTime() / 1000)
    ),
    prisma.planSubscription.findMany({
      where: {
        plan: { businessId },
        status: { in: ["active", "trialing"] },
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
  ]);

  const currentMrr = calcMrr(mrrSubs);

  // Compute revenue chart data
  let monthlyRevenue: Array<{ month: string; revenue: number }> = [];
  let mrrHistory: Array<{ month: string; mrr: number }> = [];

  if (stripeInvoices) {
    const monthlyRevenueMap = new Map<string, number>();

    for (const inv of stripeInvoices) {
      const date = new Date(inv.created * 1000);
      const monthKey = date.toISOString().slice(0, 7);
      monthlyRevenueMap.set(
        monthKey,
        (monthlyRevenueMap.get(monthKey) || 0) + inv.amountPaid
      );
    }

    monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue }));

    const lastMonthRevenueValue =
      monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
    mrrHistory = monthlyRevenue.map(({ month, revenue }) => ({
      month,
      mrr:
        lastMonthRevenueValue > 0
          ? Math.round((revenue / lastMonthRevenueValue) * currentMrr)
          : currentMrr,
    }));
  }

  return (
    <div className="mb-6">
      <RevenueChart
        monthlyRevenue={monthlyRevenue}
        mrrHistory={mrrHistory}
        currency={businessCurrency}
      />
    </div>
  );
}
