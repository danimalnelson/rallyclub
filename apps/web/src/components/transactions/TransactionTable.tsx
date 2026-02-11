"use client";

import { useCallback } from "react";
import { formatCurrency } from "@wine-club/ui";
import {
  Download,
  DollarSign,
  UserPlus,
  XCircle,
  Clock,
  RotateCcw,
  Receipt,
  type LucideIcon,
} from "lucide-react";
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
      <span className="text-sm text-muted-foreground">•••• {last4}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Transaction type icons
// ---------------------------------------------------------------------------

const TYPE_ICON_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  PAYMENT:              { icon: DollarSign, color: "#16a34a", bg: "rgba(22, 163, 74, 0.1)" },
  CHARGE:               { icon: DollarSign, color: "#16a34a", bg: "rgba(22, 163, 74, 0.1)" },
  SUBSCRIPTION_CREATED: { icon: UserPlus,   color: "#2563eb", bg: "rgba(37, 99, 235, 0.1)" },
  VOIDED:               { icon: XCircle,    color: "#dc2626", bg: "rgba(220, 38, 38, 0.1)" },
  PENDING:              { icon: Clock,      color: "#d97706", bg: "rgba(217, 119, 6, 0.1)" },
  REFUND:               { icon: RotateCcw,  color: "#9333ea", bg: "rgba(147, 51, 234, 0.1)" },
  PAYOUT_FEE:           { icon: Receipt,    color: "#666666", bg: "rgba(102, 102, 102, 0.1)" },
};

const DEFAULT_TYPE_ICON = { icon: DollarSign, color: "#666666", bg: "rgba(102, 102, 102, 0.1)" };

function TransactionTypeLabel({ type }: { type: string }) {
  const config = TYPE_ICON_CONFIG[type] || DEFAULT_TYPE_ICON;
  const Icon = config.icon;
  const raw = type.replace(/_/g, " ");
  const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded shrink-0"
        style={{ width: 16, height: 16, backgroundColor: config.bg }}
      >
        <Icon style={{ width: 10, height: 10, color: config.color }} strokeWidth={2.5} />
      </span>
      <span>{label}</span>
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

export function TransactionTable({ transactions, timeZone }: { transactions: Transaction[]; timeZone?: string }) {
  const table = useDataTable({
    data: transactions,
    filters: FILTER_CONFIGS,
    filterFn,
  });

  const columns: Column<Transaction>[] = [
    {
      key: "type",
      label: "Type",
      cellClassName: "font-medium text-[#171717]",
      render: (t) => <TransactionTypeLabel type={t.type} />,
    },
    {
      key: "amount",
      label: "Amount",
      render: (t) => (t.amount > 0 ? formatCurrency(t.amount, t.currency) : "—"),
    },
    {
      key: "plan",
      label: "Plan",
      render: (t) => t.description,
    },
    {
      key: "customer",
      label: "Customer",
      render: (t) => t.customerName || t.customerEmail.split("@")[0],
    },
    {
      key: "email",
      label: "Email",
      cellClassName: "text-muted-foreground",
      render: (t) => t.customerEmail,
    },
    {
      key: "paymentMethod",
      label: "Payment method",
      render: (t) => <PaymentMethod brand={t.paymentMethodBrand} last4={t.paymentMethodLast4} />,
    },
    {
      key: "date",
      label: "Date",
      render: (t) => formatTransactionDate(t.date, timeZone),
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
      title="Activity"
      columns={columns}
      data={transactions}
      keyExtractor={(t) => t.id}
      filterFn={filterFn}
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
      emptyMessage="No transactions yet"
      filteredEmptyMessage="No transactions match filters"
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
