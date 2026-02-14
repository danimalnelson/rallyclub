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
}

export function ActiveSubscriptionsTable({
  subscriptions,
  stripeAccountId,
  emptyMessage = "No active subscriptions",
}: ActiveSubscriptionsTableProps) {
  const columns: ListColumn<Subscription>[] = [
    {
      key: "plan",
      label: "Plan",
      cellClassName: "font-medium",
      render: (sub) => (
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span>{sub.plan.name}</span>
            {sub.pausedAt ? (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                ⏸ Paused
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                {sub.status}
              </span>
            )}
          </div>
          {sub.cancelAtPeriodEnd && (
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ Cancels at end of period
            </p>
          )}
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      cellClassName: "text-muted-foreground",
      render: (sub) =>
        sub.plan.basePrice
          ? formatCurrency(sub.plan.basePrice, sub.plan.currency)
          : "Variable",
    },
    {
      key: "period",
      label: "Current Period",
      cellClassName: "text-muted-foreground",
      render: (sub) =>
        `${formatDate(sub.currentPeriodStart)} – ${formatDate(sub.currentPeriodEnd)}`,
    },
    {
      key: "nextBilling",
      label: "Next Billing",
      cellClassName: "text-muted-foreground",
      render: (sub) => formatDate(sub.currentPeriodEnd),
    },
    {
      key: "created",
      label: "Created",
      cellClassName: "text-muted-foreground",
      render: (sub) => formatDate(sub.createdAt),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      headerClassName: "w-0",
      cellClassName: "text-right",
      render: (sub) => (
        <div className="flex items-center justify-end gap-3">
          <a
            href={`https://dashboard.stripe.com/${stripeAccountId ? `connect/accounts/${stripeAccountId}/` : ""}subscriptions/${sub.stripeSubscriptionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            View in Stripe <External className="h-3 w-3" />
          </a>
          <SubscriptionActions
            subscriptionId={sub.id}
            stripeSubscriptionId={sub.stripeSubscriptionId}
            status={sub.status}
            cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
            pausedAt={sub.pausedAt}
          />
        </div>
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
    />
  );
}
