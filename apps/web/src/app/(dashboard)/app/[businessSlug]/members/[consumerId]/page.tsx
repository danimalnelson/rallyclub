import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { formatDate } from "@wine-club/ui";
import { ChevronBreadcrumb } from "@/components/icons/ChevronBreadcrumb";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { EditMemberInfoDialog } from "@/components/members/EditMemberInfoDialog";
import { ActiveSubscriptionsTable } from "@/components/members/ActiveSubscriptionsTable";
import { MemberActivity, type MemberActivityEvent } from "@/components/members/MemberActivity";
import { MemberNote } from "@/components/members/MemberNote";
import { MemberInsights } from "@/components/members/MemberInsights";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ businessSlug: string; consumerId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug, consumerId } = await params;

  // Uses React cache() — shared with layout
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Run consumer, subscriptions, transactions, and note queries in parallel
  const [consumer, subscriptions, transactions, note] = await Promise.all([
    prisma.consumer.findUnique({
      where: { id: consumerId },
      include: {
        paymentMethods: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { brand: true, last4: true },
        },
      },
    }),
    prisma.planSubscription.findMany({
      where: {
        consumerId,
        plan: { businessId: business.id },
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: {
        consumerId,
        businessId: business.id,
      },
      orderBy: { createdAt: "desc" },
    }),
    (async () => {
      try {
        if (prisma.memberNote) {
          return await prisma.memberNote.findFirst({
            where: { consumerId },
            orderBy: { createdAt: "desc" },
          });
        }
        return null;
      } catch {
        return null;
      }
    })(),
  ]);

  if (!consumer) {
    notFound();
  }

  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "active" || sub.status === "trialing"
  );

  // Build unified activity timeline from subscriptions + transactions
  const activityEvents: MemberActivityEvent[] = [];
  const pm = consumer.paymentMethods[0] ?? null;
  const pmBrand = pm?.brand ?? null;
  const pmLast4 = pm?.last4 ?? null;

  // Subscription lifecycle events
  for (const sub of subscriptions) {
    activityEvents.push({
      id: `sub-created-${sub.id}`,
      type: "SUBSCRIPTION_CREATED",
      date: sub.createdAt,
      description: sub.plan.name,
      planName: sub.plan.name,
      amount: sub.plan.basePrice,
      currency: sub.plan.currency || "usd",
      paymentMethodBrand: pmBrand,
      paymentMethodLast4: pmLast4,
    });

    // Cancellation scheduled (still active, but will cancel at period end)
    if (sub.cancelAtPeriodEnd && sub.status !== "canceled") {
      activityEvents.push({
        id: `sub-cancel-scheduled-${sub.id}`,
        type: "CANCELLATION_SCHEDULED",
        date: sub.updatedAt,
        description: sub.plan.name,
        planName: sub.plan.name,
        amount: null,
        currency: null,
        paymentMethodBrand: null,
        paymentMethodLast4: null,
      });
    }

    if (sub.status === "canceled") {
      activityEvents.push({
        id: `sub-cancelled-${sub.id}`,
        type: "SUBSCRIPTION_CANCELLED",
        date: sub.updatedAt,
        description: sub.plan.name,
        planName: sub.plan.name,
        amount: null,
        currency: null,
        paymentMethodBrand: null,
        paymentMethodLast4: null,
      });
    }

    if (sub.pausedAt) {
      activityEvents.push({
        id: `sub-paused-${sub.id}`,
        type: "SUBSCRIPTION_PAUSED",
        date: sub.pausedAt,
        description: sub.plan.name,
        planName: sub.plan.name,
        amount: null,
        currency: null,
        paymentMethodBrand: null,
        paymentMethodLast4: null,
      });
    }
  }

  // Transaction events (payments, refunds)
  for (const tx of transactions) {
    const showPm = tx.type === "CHARGE" || tx.type === "REFUND";
    activityEvents.push({
      id: `tx-${tx.id}`,
      type: tx.type,
      date: tx.createdAt,
      description: "",
      planName: null,
      amount: tx.amount,
      currency: tx.currency,
      paymentMethodBrand: showPm ? pmBrand : null,
      paymentMethodLast4: showPm ? pmLast4 : null,
    });
  }

  // Sort by date, newest first
  activityEvents.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Calculate total spend from transactions
  const totalCharged = transactions
    .filter((tx) => tx.type === "CHARGE")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalRefunded = transactions
    .filter((tx) => tx.type === "REFUND")
    .reduce((sum, tx) => sum + tx.amount, 0);
  const currency = transactions[0]?.currency || "usd";

  const memberName = consumer.name || consumer.email.split("@")[0];

  return (
    <>
      <PageHeader>
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Link
            href={`/app/${business.slug}/members`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Members
          </Link>
          <ChevronBreadcrumb size={14} className="text-gray-500 shrink-0" />
          <span className="truncate">{memberName}</span>
        </div>
      </PageHeader>

      <div className="p-6">
        <div className="flex gap-6">
          {/* Left column — main content */}
          <div className="flex-1 min-w-0">
            {/* Subscriptions */}
            <SectionCard title="Subscriptions" flush className="mb-6">
              <ActiveSubscriptionsTable
                subscriptions={activeSubscriptions}
                stripeAccountId={business.stripeAccountId}
                businessSlug={businessSlug}
                emptyMessage={
                  subscriptions.length === 0
                    ? "This member has no subscriptions in this business."
                    : undefined
                }
              />
            </SectionCard>

            {/* Activity */}
            <SectionCard title="Activity" flush>
              <MemberActivity events={activityEvents} />
            </SectionCard>
          </div>

          {/* Right column — info, note & insights */}
          <div className="w-80 shrink-0 space-y-6 hidden lg:block">
            <SectionCard
              title="Member Information"
              headerAction={
                <EditMemberInfoDialog
                  businessId={business.id}
                  consumerId={consumer.id}
                  initialName={consumer.name}
                  initialPhone={consumer.phone}
                  email={consumer.email}
                />
              }
            >
              <div className="space-y-3">
                <div>
                  <div className="text-12 text-gray-600">Name</div>
                  <div className="text-14 font-medium">{consumer.name || "—"}</div>
                </div>
                <div>
                  <div className="text-12 text-gray-600">Email</div>
                  <div className="text-14 font-medium">{consumer.email}</div>
                </div>
                <div>
                  <div className="text-12 text-gray-600">Phone</div>
                  <div className="text-14 font-medium">{consumer.phone || "—"}</div>
                </div>
              </div>
            </SectionCard>
            <MemberInsights
              totalCharged={totalCharged}
              totalRefunded={totalRefunded}
              currency={currency}
              memberSince={consumer.createdAt}
            />
            <MemberNote
              consumerId={consumer.id}
              noteContent={note?.content ?? null}
              noteId={note?.id ?? null}
            />
          </div>
        </div>
      </div>
    </>
  );
}

