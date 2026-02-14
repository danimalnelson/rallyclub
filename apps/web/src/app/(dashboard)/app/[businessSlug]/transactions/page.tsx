import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { prisma, Prisma } from "@wine-club/db";
import { authOptions } from "@/lib/auth";
import { getStripeClient } from "@wine-club/lib";
import { Card, CardContent } from "@wine-club/ui";
import { getBusinessBySlug } from "@/lib/data/business";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import TransactionsLoading from "./loading";

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

  // Run Stripe API call and DB query in parallel (with error handling)
  type PlanSubWithPlan = Prisma.PlanSubscriptionGetPayload<{ include: { plan: true; consumer: true } }>;
  let stripeInvoices: Awaited<ReturnType<ReturnType<typeof getStripeClient>["invoices"]["list"]>> | null = null;
  let planSubscriptions: PlanSubWithPlan[] = [];

  try {
    const stripe = getStripeClient(business.stripeAccountId);
    [stripeInvoices, planSubscriptions] = await Promise.all([
      stripe.invoices.list({ limit: 100, expand: ["data.charge"] }),
      prisma.planSubscription.findMany({
        where: {
          plan: { businessId: business.id },
        },
        include: {
          consumer: true,
          plan: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
  } catch (error) {
    console.error("Transactions page error:", error);
    return (
      <div className="max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Failed to load transactions. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build a lookup from Stripe subscription ID to plan name
  const subIdToPlanName = new Map<string, string>();
  for (const sub of planSubscriptions) {
    if (sub.stripeSubscriptionId) {
      subIdToPlanName.set(sub.stripeSubscriptionId, sub.plan.name);
    }
  }

  // Format dates on server to avoid hydration mismatch (Intl can differ server vs client)
  const formatDate = (date: Date, tz?: string | null) => {
    const d = date instanceof Date ? date : new Date(date);
    const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: tz || undefined }).format(d);
    const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: tz || undefined }).format(d);
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: tz || undefined }).format(d);
    return `${month} ${day}, ${time}`;
  };

  // Create combined transaction list
  const transactions = [
    ...stripeInvoices.data.map((invoice) => {
      const charge = typeof invoice.charge === "object" && invoice.charge !== null ? invoice.charge : null;
      const card = charge?.payment_method_details?.card ?? null;
      // Resolve plan name from invoice's subscription
      const planName = invoice.subscription
        ? subIdToPlanName.get(typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id) ?? null
        : null;
      const date = new Date(invoice.created * 1000);
      return {
        id: invoice.id,
        date,
        dateDisplay: formatDate(date, business.timeZone),
        type: invoice.status === "paid" ? "PAYMENT" : invoice.status === "void" ? "VOIDED" : "PENDING",
        amount: invoice.amount_paid,
        currency: invoice.currency,
        customerEmail: invoice.customer_email || "Unknown",
        customerName: invoice.customer_name || null,
        description: planName || "–",
        stripeId: invoice.id,
        paymentMethodBrand: card?.brand ?? null,
        paymentMethodLast4: card?.last4 ?? null,
      };
    }),
    ...planSubscriptions.flatMap((sub) => {
      type SubTx = {
        id: string;
        date: Date;
        dateDisplay: string;
        type: "SUBSCRIPTION_CREATED" | "SUBSCRIPTION_CANCELLED";
        amount: number;
        currency: string;
        customerEmail: string;
        customerName: string | null;
        description: string;
        stripeId: string | null;
        paymentMethodBrand: string | null;
        paymentMethodLast4: string | null;
      };
      const items: SubTx[] = [
        {
          id: `sub-created-${sub.id}`,
          date: sub.createdAt,
          dateDisplay: formatDate(sub.createdAt, business.timeZone),
          type: "SUBSCRIPTION_CREATED",
          amount: 0,
          currency: "usd",
          customerEmail: sub.consumer.email,
          customerName: sub.consumer.name,
          description: sub.plan.name,
          stripeId: sub.stripeSubscriptionId,
          paymentMethodBrand: null,
          paymentMethodLast4: null,
        },
      ];
      if (sub.status === "canceled") {
        items.push({
          id: `sub-cancelled-${sub.id}`,
          date: sub.lastSyncedAt,
          dateDisplay: formatDate(sub.lastSyncedAt, business.timeZone),
          type: "SUBSCRIPTION_CANCELLED",
          amount: 0,
          currency: "usd",
          customerEmail: sub.consumer.email,
          customerName: sub.consumer.name,
          description: sub.plan.name,
          stripeId: sub.stripeSubscriptionId,
          paymentMethodBrand: null,
          paymentMethodLast4: null,
        });
      }
      return items;
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="max-w-7xl mx-auto">
      <TransactionTable transactions={transactions} timeZone={business.timeZone} />
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
