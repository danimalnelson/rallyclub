import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";
import { Card, CardContent } from "@wine-club/ui";
import { getBusinessBySlug } from "@/lib/data/business";
import { TransactionTable } from "@/components/transactions/TransactionTable";

export default async function TransactionsPage({
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

  // Run Stripe API call and DB query in parallel
  const stripe = getStripeClient(business.stripeAccountId);
  const [stripeInvoices, planSubscriptions] = await Promise.all([
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

  // Build a lookup from Stripe subscription ID to plan name
  const subIdToPlanName = new Map<string, string>();
  for (const sub of planSubscriptions) {
    if (sub.stripeSubscriptionId) {
      subIdToPlanName.set(sub.stripeSubscriptionId, sub.plan.name);
    }
  }

  // Create combined transaction list
  const transactions = [
    ...stripeInvoices.data.map((invoice) => {
      const charge = typeof invoice.charge === "object" && invoice.charge !== null ? invoice.charge : null;
      const card = charge?.payment_method_details?.card ?? null;
      // Resolve plan name from invoice's subscription
      const planName = invoice.subscription
        ? subIdToPlanName.get(typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription.id) ?? null
        : null;
      return {
        id: invoice.id,
        date: new Date(invoice.created * 1000),
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
    ...planSubscriptions.map((sub) => ({
      id: `sub-${sub.id}`,
      date: sub.createdAt,
      type: "SUBSCRIPTION_CREATED",
      amount: 0,
      currency: "usd",
      customerEmail: sub.consumer.email,
      customerName: sub.consumer.name,
      description: `Subscribed to ${sub.plan.name}`,
      stripeId: sub.stripeSubscriptionId,
      paymentMethodBrand: null,
      paymentMethodLast4: null,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="max-w-7xl mx-auto">
      <TransactionTable transactions={transactions} timeZone={business.timeZone} />
    </div>
  );
}
