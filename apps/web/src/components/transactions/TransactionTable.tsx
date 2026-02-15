"use client";

import React, { useCallback } from "react";
import { Button, formatCurrency } from "@wine-club/ui";
import { Download, CrossCircle, FileText } from "geist-icons";
import { Clock } from "@/components/icons/Clock";
import { Dollar } from "@/components/icons/Dollar";
import { Amex } from "@/components/icons/Amex";
import { Mastercard } from "@/components/icons/Mastercard";
import { Visa } from "@/components/icons/Visa";
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
  description: string;
  stripeId: string | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
}

// ---------------------------------------------------------------------------
// Card brand logos
// ---------------------------------------------------------------------------

const CARD_BRAND_LOGOS: Record<string, string> = {
  visa: "/card-brands/visa.svg",
  discover: "/card-brands/discover.svg",
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function CardBrandIcon({ brand }: { brand: string }) {
  const key = brand.toLowerCase();
  if (key === "visa") return <Visa size={16} className="h-4 w-auto" />;
  if (key === "mastercard") return <Mastercard size={16} className="h-4 w-auto" />;
  if (key === "amex") return <Amex size={16} className="h-4 w-auto" />;
  const logo = CARD_BRAND_LOGOS[key];
  return (
    <img
      src={logo || "/card-brands/generic.svg"}
      alt={CARD_BRAND_LABELS[key] || brand}
      className="h-4 w-auto"
    />
  );
}

function PaymentMethod({ brand, last4 }: { brand: string | null; last4: string | null }) {
  if (!brand || !last4) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center">
      <CardBrandIcon brand={brand} />
      <span className="text-xs ml-2" style={{ letterSpacing: "0.1em" }}>••••</span><span className="text-sm ml-1">{last4}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction type icons
// ---------------------------------------------------------------------------

const TYPE_ICON_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  PAYMENT:              { icon: Dollar, color: "var(--ds-green-700)", bg: "var(--ds-green-100)" },
  CHARGE:               { icon: Dollar, color: "var(--ds-green-700)", bg: "var(--ds-green-100)" },
  SUBSCRIPTION_CREATED: { icon: SubscriptionCreated, color: "var(--ds-blue-700)", bg: "var(--ds-blue-100)" },
  VOIDED:               { icon: CrossCircle, color: "var(--ds-red-700)", bg: "var(--ds-red-100)" },
  PENDING:              { icon: Clock, color: "var(--ds-amber-700)", bg: "var(--ds-amber-100)" },
  REFUND:               { icon: RefreshCounterClockwise, color: "var(--ds-purple-700)", bg: "var(--ds-purple-100)" },
  SUBSCRIPTION_CANCELLED:   { icon: SubscriptionCancelled, color: "var(--ds-red-700)", bg: "var(--ds-red-100)" },
  SUBSCRIPTION_PAUSED:      { icon: PauseCircle, color: "var(--ds-amber-700)", bg: "var(--ds-amber-100)" },
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
  SUBSCRIPTION_CREATED: "Subscription started",
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
      { value: "PAYMENT", label: "Payment", icon: <TypeIcon type="PAYMENT" /> },
      { value: "PENDING", label: "Pending", icon: <TypeIcon type="PENDING" /> },
      { value: "REFUND", label: "Refund", icon: <TypeIcon type="REFUND" /> },
      { value: "SUBSCRIPTION_CANCELLED", label: "Subscription canceled", icon: <TypeIcon type="SUBSCRIPTION_CANCELLED" /> },
      { value: "SUBSCRIPTION_PAUSED", label: "Subscription paused", icon: <TypeIcon type="SUBSCRIPTION_PAUSED" /> },
      { value: "SUBSCRIPTION_CREATED", label: "Subscription started", icon: <TypeIcon type="SUBSCRIPTION_CREATED" /> },
      { value: "VOIDED", label: "Voided", icon: <TypeIcon type="VOIDED" /> },
    ],
  },
  { type: "text", key: "name", label: "Name" },
  { type: "text", key: "email", label: "Email" },
  { type: "text", key: "plan", label: "Plan" },
  {
    type: "text",
    key: "last4",
    label: "Payment method",
    placeholder: "e.g. 4242",
    maxLength: 4,
    inputTransform: (v) => v.replace(/\D/g, ""),
    formatActive: (v) => `••${v}`,
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
  if (filters.last4) {
    if (!t.paymentMethodLast4 || !t.paymentMethodLast4.includes(filters.last4)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionTable({ transactions }: { transactions: Transaction[]; timeZone?: string }) {
  const table = useDataTable({
    data: transactions,
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
      render: (t) => <PaymentMethod brand={t.paymentMethodBrand} last4={t.paymentMethodLast4} />,
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
      data={transactions}
      keyExtractor={(t) => t.id}
      table={table}
      emptyMessage="No transactions yet"
      filteredEmptyMessage="No transactions match filters"
      actions={
        <Button
          variant="secondary"
          onClick={exportCsv}
          prefix={<Download className="h-3.5 w-3.5" />}
        >
          Export
        </Button>
      }
    />
  );
}
