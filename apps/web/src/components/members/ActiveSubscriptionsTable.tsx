"use client";

import { formatDate, formatCurrency } from "@wine-club/ui";
import { External } from "geist-icons";
import { List, type ListColumn } from "@/components/ui/data-table";
import { SubscriptionActions } from "./SubscriptionActions";

type Subscription = {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean | null;
  pausedAt: Date | null;
  createdAt: Date;
  stripeSubscriptionId: string;
  plan: {
    id: string;
    name: string;
    basePrice: number | null;
    currency: string;
  };
};

interface ActiveSubscriptionsTableProps {
  subscriptions: Subscription[];
  stripeAccountId: string | null;
  /** Override default empty message (e.g. when member has no subscriptions at all) */
  emptyMessage?: string;
  /** For View plan / Edit links in action popover */
  businessSlug?: string;
}

export function ActiveSubscriptionsTable({
  subscriptions,
  stripeAccountId,
  emptyMessage = "No active subscriptions",
  businessSlug,
}: ActiveSubscriptionsTableProps) {
  const columns: ListColumn<Subscription>[] = [
    {
      key: "plan",
      label: "Plan",
      cellClassName: "font-medium",
      render: (sub) => (
        <span className="truncate">{sub.plan.name}</span>
      ),
    },
    {
      key: "price",
      label: "Price",
      render: (sub) =>
        sub.plan.basePrice
          ? formatCurrency(sub.plan.basePrice, sub.plan.currency)
          : "Variable",
    },
    {
      key: "period",
      label: "Current Period",
      render: (sub) =>
        `${formatDate(sub.currentPeriodStart)} – ${formatDate(sub.currentPeriodEnd)}`,
    },
    {
      key: "nextBilling",
      label: "Next Billing",
      render: (sub) =>
        sub.cancelAtPeriodEnd ? (
          <span className="text-red-600">Cancels {formatDate(sub.currentPeriodEnd)}</span>
        ) : sub.pausedAt ? (
          <span className="text-amber-600">Paused</span>
        ) : (
          formatDate(sub.currentPeriodEnd)
        ),
    },
    {
      key: "created",
      label: "Started",
      render: (sub) => formatDate(sub.createdAt),
    },
    {
      key: "stripe",
      label: "",
      align: "right",
      headerClassName: "w-0",
      cellClassName: "text-right",
      render: (sub) => (
        <a
          href={`https://dashboard.stripe.com/${stripeAccountId ? `connect/accounts/${stripeAccountId}/` : ""}subscriptions/${sub.stripeSubscriptionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          View in Stripe <External className="h-3 w-3" />
        </a>
      ),
    },
  ];

  return (
    <List
      columns={columns}
      items={subscriptions}
      keyExtractor={(sub) => sub.id}
      variableRowHeight
      emptyMessage={emptyMessage}
      emptyDescription={
        emptyMessage === "No active subscriptions"
          ? "Active subscriptions will appear here"
          : undefined
      }
      rowActions={(sub) => (
        <SubscriptionActions
          subscriptionId={sub.id}
          stripeSubscriptionId={sub.stripeSubscriptionId}
          status={sub.status}
          cancelAtPeriodEnd={sub.cancelAtPeriodEnd ?? false}
          pausedAt={sub.pausedAt}
          compact
          businessSlug={businessSlug}
          planId={sub.plan.id}
        />
      )}
    />
  );
}
