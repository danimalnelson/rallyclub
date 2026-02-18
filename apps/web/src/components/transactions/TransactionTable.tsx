"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, formatCurrency, MenuContainer, Menu, MenuItem, MenuIconTrigger } from "@wine-club/ui";
import { Download, CrossCircle, FileText, MoreVertical } from "geist-icons";
import { Clock } from "@/components/icons/Clock";
import { Dollar } from "@/components/icons/Dollar";
import { PauseCircle } from "@/components/icons/PauseCircle";
import { RefreshCounterClockwise } from "@/components/icons/RefreshCounterClockwise";
import { SubscriptionCancelled } from "@/components/icons/SubscriptionCancelled";
import { SubscriptionCreated } from "@/components/icons/SubscriptionCreated";
import {
  DataTable,
  useDataTable,
  type Column,
  type FilterConfig,
} from "@/components/ui/data-table";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { PaymentMethodInline } from "@/components/ui/payment-method";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  date: Date;
  dateDisplay: string;
  type: string;
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string | null;
  consumerId: string;
  description: string;
  stripeId: string | null;
  /** Set when this event can be refunded — either a DB transaction ID (for CHARGE)
      or a Stripe subscription ID prefixed with "stripe:" (for SUBSCRIPTION_CREATED) */
  refundableId: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
}

// ---------------------------------------------------------------------------
// Transaction type icons
// ---------------------------------------------------------------------------

const TYPE_ICON_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  PAYMENT:              { icon: Dollar, color: "var(--ds-gray-900)", bg: "var(--ds-gray-100)" },
  CHARGE:               { icon: Dollar, color: "var(--ds-blue-700)", bg: "var(--ds-blue-100)" },
  SUBSCRIPTION_CREATED: { icon: SubscriptionCreated, color: "var(--ds-green-700)", bg: "var(--ds-green-100)" },
  START_FAILED:         { icon: CrossCircle, color: "var(--ds-gray-900)", bg: "var(--ds-gray-100)" },
  RENEWAL_FAILED:       { icon: CrossCircle, color: "var(--ds-red-700)", bg: "var(--ds-red-100)" },
  VOIDED:               { icon: CrossCircle, color: "var(--ds-red-700)", bg: "var(--ds-red-100)" },
  PENDING:              { icon: Clock, color: "var(--ds-amber-700)", bg: "var(--ds-amber-100)" },
  REFUND:               { icon: RefreshCounterClockwise, color: "var(--ds-gray-900)", bg: "var(--ds-gray-100)" },
  CANCELLATION_SCHEDULED:   { icon: SubscriptionCancelled, color: "var(--ds-amber-700)", bg: "var(--ds-amber-100)" },
  SUBSCRIPTION_CANCELLED:   { icon: SubscriptionCancelled, color: "var(--ds-amber-700)", bg: "var(--ds-amber-100)" },
  SUBSCRIPTION_PAUSED:      { icon: PauseCircle, color: "var(--ds-purple-700)", bg: "var(--ds-purple-100)" },
  PAYOUT_FEE:               { icon: FileText, color: "var(--ds-gray-900)", bg: "var(--ds-gray-100)" },
};

const DEFAULT_TYPE_ICON = { icon: Dollar, color: "var(--ds-gray-900)", bg: "var(--ds-gray-100)" };

function TypeIcon({ type }: { type: string }) {
  const config = TYPE_ICON_CONFIG[type] || DEFAULT_TYPE_ICON;
  const Icon = config.icon;
  return (
    <div
      className="flex items-center justify-center rounded shrink-0"
      style={{ width: 24, height: 24, backgroundColor: config.bg }}
    >
        <Icon size={16} color={config.color} />
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION_CREATED: "Started",
  START_FAILED: "Failed",
  CHARGE: "Renewed",
  RENEWAL_FAILED: "Failed",
  SUBSCRIPTION_PAUSED: "Paused",
  CANCELLATION_SCHEDULED: "Canceled",
  SUBSCRIPTION_CANCELLED: "Canceled",
  REFUND: "Refunded",
  PAYOUT_FEE: "Payout fee",
};

function TransactionTypeLabel({ type }: { type: string }) {
  const config = TYPE_ICON_CONFIG[type] || DEFAULT_TYPE_ICON;
  const Icon = config.icon;
  const raw = type.replace(/_/g, " ");
  const label = TYPE_LABELS[type] || raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex items-center justify-center rounded shrink-0"
        style={{ width: 24, height: 24, backgroundColor: config.bg }}
      >
        <Icon size={16} color={config.color} />
      </div>
      <span>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Filter + column config
// ---------------------------------------------------------------------------

const FILTER_CONFIGS: FilterConfig[] = [
  {
    type: "select",
    key: "type",
    label: "Type",
    options: [
      { value: "SUBSCRIPTION_CREATED", label: "Started", icon: <TypeIcon type="SUBSCRIPTION_CREATED" /> },
      { value: "CHARGE", label: "Renewed", icon: <TypeIcon type="CHARGE" /> },
      { value: "SUBSCRIPTION_PAUSED", label: "Paused", icon: <TypeIcon type="SUBSCRIPTION_PAUSED" /> },
      { value: "SUBSCRIPTION_CANCELLED,CANCELLATION_SCHEDULED", label: "Canceled", icon: <TypeIcon type="SUBSCRIPTION_CANCELLED" /> },
      { value: "RENEWAL_FAILED", label: "Failed", icon: <TypeIcon type="RENEWAL_FAILED" /> },
    ],
  },
  { type: "text", key: "name", label: "Name", placeholder: "Name contains..." },
  { type: "text", key: "email", label: "Email", placeholder: "Email contains..." },
  { type: "text", key: "plan", label: "Plan", placeholder: "Plan contains..." },
  {
    type: "text",
    key: "paymentMethod",
    label: "Payment method",
    placeholder: "Payment method contains...",
  },
];

function filterFn(t: Transaction, filters: Record<string, string>): boolean {
  if (filters.name) {
    const name = t.customerName || t.customerEmail.split("@")[0];
    if (!name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  }
  if (filters.email) {
    if (!t.customerEmail.toLowerCase().includes(filters.email.toLowerCase())) return false;
  }
  if (filters.plan) {
    if (!t.description.toLowerCase().includes(filters.plan.toLowerCase())) return false;
  }
  if (filters.type) {
    const types = filters.type.split(",");
    if (!types.includes(t.type)) return false;
  }
  if (filters.paymentMethod) {
    const q = filters.paymentMethod.toLowerCase();
    const brand = (t.paymentMethodBrand || "").toLowerCase();
    const last4 = t.paymentMethodLast4 || "";
    if (!brand.includes(q) && !last4.includes(q)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Row actions
// ---------------------------------------------------------------------------

function TransactionActions({
  transaction,
  businessSlug,
  stripeAccountId,
}: {
  transaction: Transaction;
  businessSlug: string;
  stripeAccountId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const canRefund = !!transaction.refundableId;
  const stripeUrl = transaction.stripeId
    ? `https://dashboard.stripe.com/${stripeAccountId ? `connect/accounts/${stripeAccountId}/` : ""}payments/${transaction.stripeId}`
    : null;

  const handleRefund = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refundableId: transaction.refundableId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to refund");
      }

      setShowRefundDialog(false);
      router.refresh();
    } catch (error: any) {
      alert(`Refund failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-stretch gap-0 overflow-hidden rounded-md border border-transparent bg-transparent transition-[border-color,background-color] group-hover:border-gray-300 group-hover:bg-white group-hover:hover:border-gray-500 dark:group-hover:border-gray-600 dark:group-hover:bg-gray-100 dark:group-hover:hover:border-gray-400">
        <MenuContainer>
          <MenuIconTrigger><MoreVertical className="h-4 w-4" /></MenuIconTrigger>
          <Menu width={192} align="end">
            {canRefund && (
              <MenuItem onClick={() => setShowRefundDialog(true)}>
                Refund
              </MenuItem>
            )}
            <MenuItem onClick={() => router.push(`/app/${businessSlug}/members/${transaction.consumerId}`)}>
              View member
            </MenuItem>
            {stripeUrl && (
              <MenuItem href={stripeUrl} target="_blank">
                View on Stripe
              </MenuItem>
            )}
          </Menu>
        </MenuContainer>
      </div>

      {canRefund && (
        <Dialog
          open={showRefundDialog}
          onClose={() => setShowRefundDialog(false)}
          title="Refund Payment"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowRefundDialog(false)} disabled={loading}>
                Cancel
              </Button>
              <Button variant="error" onClick={handleRefund} loading={loading}>
                Refund {formatCurrency(transaction.amount, transaction.currency)}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-600 dark:text-gray-800">
            This will issue a full refund of{" "}
            <strong>{formatCurrency(transaction.amount, transaction.currency)}</strong>{" "}
            to {transaction.customerName || transaction.customerEmail}.
            This action cannot be undone.
          </p>
        </Dialog>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionTable({
  transactions,
  businessSlug,
  stripeAccountId,
}: {
  transactions: Transaction[];
  businessSlug: string;
  stripeAccountId: string;
}) {
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

  const dateFiltered = React.useMemo(() => {
    const visible = transactions.filter((t) => t.type !== "START_FAILED");
    if (!dateRange.from && !dateRange.to) return visible;
    return visible.filter((t) => {
      const d = t.date instanceof Date ? t.date.getTime() : new Date(t.date).getTime();
      if (dateRange.from && d < dateRange.from.getTime()) return false;
      if (dateRange.to && d > dateRange.to.getTime()) return false;
      return true;
    });
  }, [transactions, dateRange]);

  const table = useDataTable({
    data: dateFiltered,
    filters: FILTER_CONFIGS,
    filterFn,
  });

  const columns: Column<Transaction>[] = [
    {
      key: "type",
      label: "Type",
      cellClassName: "font-medium",
      render: (t) => <TransactionTypeLabel type={t.type} />,
    },
    {
      key: "name",
      label: "Name",
      render: (t) => t.customerName || t.customerEmail.split("@")[0],
    },
    {
      key: "email",
      label: "Email",
      render: (t) => t.customerEmail,
    },
    {
      key: "plan",
      label: "Plan",
      render: (t) => t.description,
    },
    {
      key: "amount",
      label: "Amount",
      render: (t) => (t.amount > 0 ? formatCurrency(t.amount, t.currency) : "—"),
    },
    {
      key: "paymentMethod",
      label: "Payment method",
      render: (t) => <PaymentMethodInline brand={t.paymentMethodBrand} last4={t.paymentMethodLast4} />,
    },
    {
      key: "date",
      label: "Date",
      render: (t) => t.dateDisplay,
    },
  ];

  const exportCsv = useCallback(() => {
    const headers = ["Type", "Name", "Email", "Plan", "Amount", "Payment Method", "Date"];
    const rows = table.filtered.map((t) => [
      t.type.replace(/_/g, " "),
      (t.customerName || t.customerEmail.split("@")[0]).replace(/,/g, ""),
      t.customerEmail,
      t.description.replace(/,/g, ""),
      t.amount > 0 ? (t.amount / 100).toFixed(2) : "0.00",
      t.paymentMethodBrand && t.paymentMethodLast4
        ? `${t.paymentMethodBrand} ****${t.paymentMethodLast4}`
        : "",
      t.date instanceof Date ? t.date.toISOString().split("T")[0] : String(t.date).split("T")[0],
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [table.filtered]);

  return (
    <DataTable
      title="Activity"
      columns={columns}
      data={dateFiltered}
      keyExtractor={(t) => t.id}
      table={table}
      extraFilters={
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      }
      rowActions={(t) => (
        <TransactionActions
          transaction={t}
          businessSlug={businessSlug}
          stripeAccountId={stripeAccountId}
        />
      )}
      emptyMessage="No transactions yet"
      filteredEmptyMessage="No transactions match filters"
      actions={
        <Button
          variant="secondary"
          size="small"
          onClick={exportCsv}
          prefix={<Download className="h-3.5 w-3.5" />}
        >
          Export
        </Button>
      }
    />
  );
}
