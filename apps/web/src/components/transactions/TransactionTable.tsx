"use client";

import { useCallback } from "react";
import { formatCurrency } from "@wine-club/ui";
import { Download } from "lucide-react";
import {
  DataTable,
  useDataTable,
  StatusBadge,
  type Column,
  type FilterConfig,
} from "@/components/ui/data-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Transaction {
  id: string;
  date: Date;
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
  mastercard: "/card-brands/mastercard.svg",
  amex: "/card-brands/amex.svg",
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
  const logo = CARD_BRAND_LOGOS[key];
  return (
    <img
      src={logo || "/card-brands/generic.svg"}
      alt={CARD_BRAND_LABELS[key] || brand}
      className="h-[18px] w-auto"
    />
  );
}

function PaymentMethod({ brand, last4 }: { brand: string | null; last4: string | null }) {
  if (!brand || !last4) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <CardBrandIcon brand={brand} />
      <span className="text-sm text-muted-foreground tracking-wide">•••• {last4}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTransactionDate(date: Date, timeZone?: string) {
  const d = date instanceof Date ? date : new Date(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(d);
  return `${month} ${day}, ${time}`;
}

// ---------------------------------------------------------------------------
// Filter + column config
// ---------------------------------------------------------------------------

const FILTER_CONFIGS: FilterConfig[] = [
  { type: "text", key: "name", label: "Name" },
  { type: "text", key: "email", label: "Email" },
  {
    type: "select",
    key: "type",
    label: "Type",
    options: [
      { value: "PAYMENT", label: "Payment" },
      { value: "SUBSCRIPTION_CREATED", label: "Subscription Created" },
      { value: "VOIDED", label: "Voided" },
      { value: "PENDING", label: "Pending" },
    ],
  },
  {
    type: "text",
    key: "last4",
    label: "Card",
    placeholder: "e.g. 4242",
    maxLength: 4,
    inputTransform: (v) => v.replace(/\D/g, ""),
    formatActive: (v) => `Card: ••${v}`,
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
  if (filters.type) {
    if (t.type !== filters.type) return false;
  }
  if (filters.last4) {
    if (!t.paymentMethodLast4 || !t.paymentMethodLast4.includes(filters.last4)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransactionTable({ transactions, timeZone }: { transactions: Transaction[]; timeZone?: string }) {
  const table = useDataTable({
    data: transactions,
    filters: FILTER_CONFIGS,
    filterFn,
  });

  const columns: Column<Transaction>[] = [
    {
      key: "date",
      label: "Date",
      render: (t) => formatTransactionDate(t.date, timeZone),
    },
    {
      key: "customer",
      label: "Customer",
      cellClassName: "font-medium",
      render: (t) => t.customerName || t.customerEmail.split("@")[0],
    },
    {
      key: "email",
      label: "Email",
      cellClassName: "text-muted-foreground",
      render: (t) => t.customerEmail,
    },
    {
      key: "plan",
      label: "Plan",
      render: (t) => t.description,
    },
    {
      key: "type",
      label: "Type",
      render: (t) => <StatusBadge status={t.type} />,
    },
    {
      key: "paymentMethod",
      label: "Payment method",
      render: (t) => <PaymentMethod brand={t.paymentMethodBrand} last4={t.paymentMethodLast4} />,
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      cellClassName: "font-medium",
      render: (t) => (t.amount > 0 ? formatCurrency(t.amount, t.currency) : "—"),
    },
  ];

  const exportCsv = useCallback(() => {
    const headers = ["Date", "Customer", "Email", "Plan", "Type", "Payment Method", "Amount"];
    const rows = table.filtered.map((t) => [
      t.date instanceof Date ? t.date.toISOString().split("T")[0] : String(t.date).split("T")[0],
      (t.customerName || t.customerEmail.split("@")[0]).replace(/,/g, ""),
      t.customerEmail,
      t.description.replace(/,/g, ""),
      t.type.replace(/_/g, " "),
      t.paymentMethodBrand && t.paymentMethodLast4
        ? `${t.paymentMethodBrand} ****${t.paymentMethodLast4}`
        : "",
      t.amount > 0 ? (t.amount / 100).toFixed(2) : "0.00",
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
      title="Transactions"
      columns={columns}
      data={transactions}
      filtered={table.filtered}
      paginated={table.paginated}
      keyExtractor={(t) => t.id}
      filterConfigs={FILTER_CONFIGS}
      filterValues={table.filterValues}
      inputValues={table.inputValues}
      openFilter={table.openFilter}
      toggleFilter={table.toggleFilter}
      applyTextFilter={table.applyTextFilter}
      applySelectFilter={table.applySelectFilter}
      clearFilter={table.clearFilter}
      setInput={table.setInput}
      page={table.page}
      setPage={table.setPage}
      totalPages={table.totalPages}
      emptyMessage="No transactions yet"
      filteredEmptyMessage="No transactions match filters"
      resultLabel="result"
      actions={
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-[#e0e0e0] bg-white text-[#171717] hover:border-[#ccc] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      }
    />
  );
}
