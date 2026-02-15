"use client";

import React, { useState } from "react";
import { Button, formatCurrency, formatDate } from "@wine-club/ui";
import { CrossCircle, FileText } from "geist-icons";
import { Clock } from "@/components/icons/Clock";
import { Dollar } from "@/components/icons/Dollar";
import { PauseCircle } from "@/components/icons/PauseCircle";
import { RefreshCounterClockwise } from "@/components/icons/RefreshCounterClockwise";
import { SubscriptionCancelled } from "@/components/icons/SubscriptionCancelled";
import { SubscriptionCreated } from "@/components/icons/SubscriptionCreated";
import { List, type ListColumn } from "@/components/ui/data-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberActivityEvent {
  id: string;
  type: string;
  date: Date;
  description: string;
  planName: string | null;
  amount: number | null;
  currency: string | null;
}

// ---------------------------------------------------------------------------
// Type icon config (shared visual language with TransactionTable)
// ---------------------------------------------------------------------------

const TYPE_ICON_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  CHARGE: {
    icon: Dollar,
    color: "var(--ds-green-700)",
    bg: "var(--ds-green-100)",
    label: "Payment",
  },
  REFUND: {
    icon: RefreshCounterClockwise,
    color: "var(--ds-purple-700)",
    bg: "var(--ds-purple-100)",
    label: "Refund",
  },
  SUBSCRIPTION_CREATED: {
    icon: SubscriptionCreated,
    color: "var(--ds-blue-700)",
    bg: "var(--ds-blue-100)",
    label: "Subscription started",
  },
  CANCELLATION_SCHEDULED: {
    icon: Clock,
    color: "var(--ds-amber-700)",
    bg: "var(--ds-amber-100)",
    label: "Cancellation scheduled",
  },
  SUBSCRIPTION_CANCELLED: {
    icon: SubscriptionCancelled,
    color: "var(--ds-red-700)",
    bg: "var(--ds-red-100)",
    label: "Subscription cancelled",
  },
  SUBSCRIPTION_PAUSED: {
    icon: PauseCircle,
    color: "var(--ds-amber-700)",
    bg: "var(--ds-amber-100)",
    label: "Subscription paused",
  },
  SUBSCRIPTION_RESUMED: {
    icon: SubscriptionCreated,
    color: "var(--ds-blue-700)",
    bg: "var(--ds-blue-100)",
    label: "Subscription resumed",
  },
  VOIDED: {
    icon: CrossCircle,
    color: "var(--ds-red-700)",
    bg: "var(--ds-red-100)",
    label: "Voided",
  },
  PENDING: {
    icon: Clock,
    color: "var(--ds-amber-700)",
    bg: "var(--ds-amber-100)",
    label: "Pending",
  },
  PAYOUT_FEE: {
    icon: FileText,
    color: "var(--ds-gray-900)",
    bg: "var(--ds-gray-100)",
    label: "Payout fee",
  },
};

const DEFAULT_ICON = {
  icon: FileText,
  color: "var(--ds-gray-900)",
  bg: "var(--ds-gray-100)",
  label: "Event",
};

function getTypeConfig(type: string) {
  return TYPE_ICON_CONFIG[type] || DEFAULT_ICON;
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: ListColumn<MemberActivityEvent>[] = [
  {
    key: "type",
    label: "Event",
    cellClassName: "font-medium",
    render: (event) => {
      const config = getTypeConfig(event.type);
      const Icon = config.icon;
      return (
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded shrink-0"
            style={{ width: 24, height: 24, backgroundColor: config.bg }}
          >
            <Icon size={16} color={config.color} />
          </div>
          <span>{config.label}</span>
        </div>
      );
    },
  },
  {
    key: "description",
    label: "Description",
    render: (event) => (
      <span className="text-gray-800">
        {event.description || event.planName || "—"}
      </span>
    ),
  },
  {
    key: "amount",
    label: "Amount",
    align: "right",
    render: (event) =>
      event.amount && event.currency
        ? formatCurrency(event.amount, event.currency)
        : "—",
  },
  {
    key: "date",
    label: "Date",
    render: (event) => formatDate(event.date),
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

export function MemberActivity({
  events,
}: {
  events: MemberActivityEvent[];
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const paginated = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <List
        columns={columns}
        items={paginated}
        keyExtractor={(e) => e.id}
        rowHeight="compact"
        emptyMessage="No activity yet"
      />
      {events.length > 0 && (
        <div className="flex items-center justify-between h-10 px-3 border-t border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-800">
          <span>
            {events.length} {events.length === 1 ? "event" : "events"}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 h-7 text-xs"
              >
                Previous
              </Button>
              <span>
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 h-7 text-xs"
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
