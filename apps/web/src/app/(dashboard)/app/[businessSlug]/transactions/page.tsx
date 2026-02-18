import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { Card, CardContent } from "@wine-club/ui";
import { authOptions } from "@/lib/auth";
import { getBusinessBySlug } from "@/lib/data/business";
import { TransactionTable, type Transaction } from "@/components/transactions/TransactionTable";
import TransactionsLoading from "./loading";

// ---------------------------------------------------------------------------
// Date formatting (server-side to avoid hydration mismatch)
// ---------------------------------------------------------------------------

function formatDateDisplay(date: Date, tz?: string | null) {
  const d = date instanceof Date ? date : new Date(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: tz || undefined }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz || undefined }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || undefined }).format(d);
  return `${month} ${day}, ${time}`;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function TransactionsContent({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  if (!business.stripeAccountId) {
    return (
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Stripe account not connected</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch from local DB — no Stripe API calls, no arbitrary limits
  const [dbTransactions, planSubscriptions] = await Promise.all([
    prisma.transaction.findMany({
      where: { businessId: business.id },
      include: {
        consumer: {
          select: {
            email: true,
            name: true,
            paymentMethods: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { brand: true, last4: true },
            },
          },
        },
        subscription: {
          include: { membershipPlan: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.planSubscription.findMany({
      where: { plan: { businessId: business.id } },
      include: {
        consumer: {
          select: {
            email: true,
            name: true,
            paymentMethods: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { brand: true, last4: true },
            },
          },
        },
        plan: { select: { name: true, basePrice: true, currency: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Build a lookup: consumerId → plan name (from PlanSubscription, for transactions
  // where the old Subscription relation doesn't provide a plan name)
  const consumerToPlanName = new Map<string, string>();
  for (const sub of planSubscriptions) {
    if (!consumerToPlanName.has(sub.consumerId)) {
      consumerToPlanName.set(sub.consumerId, sub.plan.name);
    }
  }


  // Consumers who have at least one successful charge (used to classify failures)
  const consumersWithCharges = new Set(
    dbTransactions.filter((tx) => tx.type === "CHARGE").map((tx) => tx.consumerId)
  );

  // Map DB transactions to the Transaction interface
  const transactions: Transaction[] = [
    // Financial events from the Transaction table
    ...dbTransactions.map((tx) => {
      const planName =
        tx.subscription?.membershipPlan?.name ??
        consumerToPlanName.get(tx.consumerId) ??
        "–";

      let uiType = tx.type as string;
      if (tx.type === "PAYMENT_FAILED") {
        uiType = consumersWithCharges.has(tx.consumerId) ? "RENEWAL_FAILED" : "START_FAILED";
      }

      const pm = tx.consumer.paymentMethods[0] ?? null;
      return {
        id: tx.id,
        date: tx.createdAt,
        dateDisplay: formatDateDisplay(tx.createdAt, business.timeZone),
        type: uiType,
        amount: tx.amount,
        currency: tx.currency,
        customerEmail: tx.consumer.email,
        customerName: tx.consumer.name,
        consumerId: tx.consumerId,
        description: planName,
        stripeId: tx.stripeChargeId || tx.stripePaymentIntentId,
        refundableId: tx.type === "CHARGE" ? `tx:${tx.id}` : null,
        paymentMethodBrand: pm?.brand ?? null,
        paymentMethodLast4: pm?.last4 ?? null,
      };
    }),

    // Subscription lifecycle events from PlanSubscription
    ...planSubscriptions.flatMap((sub) => {
      const pm = sub.consumer.paymentMethods[0] ?? null;
      const items: Transaction[] = [
        {
          id: `sub-created-${sub.id}`,
          date: sub.createdAt,
          dateDisplay: formatDateDisplay(sub.createdAt, business.timeZone),
          type: "SUBSCRIPTION_CREATED",
          amount: sub.plan.basePrice ?? 0,
          currency: sub.plan.currency || "usd",
          customerEmail: sub.consumer.email,
          customerName: sub.consumer.name,
          consumerId: sub.consumerId,
          description: sub.plan.name,
          stripeId: sub.stripeSubscriptionId,
          refundableId: sub.stripeSubscriptionId ? `sub:${sub.stripeSubscriptionId}` : null,
          paymentMethodBrand: pm?.brand ?? null,
          paymentMethodLast4: pm?.last4 ?? null,
        },
      ];

      // Cancellation scheduled (still active, but will cancel at period end)
      if (sub.cancelAtPeriodEnd && sub.status !== "canceled") {
        items.push({
          id: `sub-cancel-scheduled-${sub.id}`,
          date: sub.updatedAt,
          dateDisplay: formatDateDisplay(sub.updatedAt, business.timeZone),
          type: "CANCELLATION_SCHEDULED",
          amount: 0,
          currency: sub.plan.currency || "usd",
          customerEmail: sub.consumer.email,
          customerName: sub.consumer.name,
          consumerId: sub.consumerId,
          description: sub.plan.name,
          stripeId: sub.stripeSubscriptionId,
          refundableId: null,
          paymentMethodBrand: null,
          paymentMethodLast4: null,
        });
      }

      if (sub.status === "canceled") {
        items.push({
          id: `sub-cancelled-${sub.id}`,
          date: sub.updatedAt,
          dateDisplay: formatDateDisplay(sub.updatedAt, business.timeZone),
          type: "SUBSCRIPTION_CANCELLED",
          amount: 0,
          currency: sub.plan.currency || "usd",
          customerEmail: sub.consumer.email,
          customerName: sub.consumer.name,
          consumerId: sub.consumerId,
          description: sub.plan.name,
          stripeId: sub.stripeSubscriptionId,
          refundableId: null,
          paymentMethodBrand: null,
          paymentMethodLast4: null,
        });
      }

      if (sub.pausedAt) {
        items.push({
          id: `sub-paused-${sub.id}`,
          date: sub.pausedAt,
          dateDisplay: formatDateDisplay(sub.pausedAt, business.timeZone),
          type: "SUBSCRIPTION_PAUSED",
          amount: 0,
          currency: sub.plan.currency || "usd",
          customerEmail: sub.consumer.email,
          customerName: sub.consumer.name,
          consumerId: sub.consumerId,
          description: sub.plan.name,
          stripeId: sub.stripeSubscriptionId,
          refundableId: null,
          paymentMethodBrand: null,
          paymentMethodLast4: null,
        });
      }

      return items;
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="max-w-7xl mx-auto">
      <TransactionTable
        transactions={transactions}
        businessSlug={businessSlug}
        stripeAccountId={business.stripeAccountId}
      />
    </div>
  );
}

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  return (
    <div className="max-w-7xl mx-auto">
      <Suspense fallback={<TransactionsLoading />}>
        <TransactionsContent params={params} />
      </Suspense>
    </div>
  );
}
