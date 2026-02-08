"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, formatCurrency } from "@wine-club/ui";
import { Plus, X, Download } from "lucide-react";

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

const CARD_BRAND_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  visa: { bg: "#1a1f71", text: "#ffffff", label: "VISA" },
  mastercard: { bg: "#eb001b", text: "#ffffff", label: "MC" },
  amex: { bg: "#006fcf", text: "#ffffff", label: "AMEX" },
  discover: { bg: "#ff6000", text: "#ffffff", label: "DISC" },
  diners: { bg: "#0079be", text: "#ffffff", label: "DC" },
  jcb: { bg: "#0e4c96", text: "#ffffff", label: "JCB" },
  unionpay: { bg: "#de2910", text: "#ffffff", label: "UP" },
};

function CardBrandBadge({ brand }: { brand: string }) {
  const info = CARD_BRAND_COLORS[brand.toLowerCase()] || { bg: "#666", text: "#fff", label: brand.toUpperCase().slice(0, 4) };
  return (
    <span
      className="inline-flex items-center justify-center rounded text-[10px] font-bold leading-none px-1.5 py-1"
      style={{ backgroundColor: info.bg, color: info.text, minWidth: 36 }}
    >
      {info.label}
    </span>
  );
}

function PaymentMethod({ brand, last4 }: { brand: string | null; last4: string | null }) {
  if (!brand || !last4) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <CardBrandBadge brand={brand} />
      <span className="text-sm text-muted-foreground tracking-wide">
        •••• {last4}
      </span>
    </span>
  );
}

interface FilterState {
  name: string;
  email: string;
  type: string | null;
}

function formatTransactionDate(date: Date, timeZone?: string) {
  const d = date instanceof Date ? date : new Date(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone }).format(d);
  return `${month} ${day}, ${time}`;
}

const TRANSACTION_TYPES = [
  { value: "PAYMENT", label: "Payment" },
  { value: "SUBSCRIPTION_CREATED", label: "Subscription Created" },
  { value: "VOIDED", label: "Voided" },
  { value: "PENDING", label: "Pending" },
];

function FilterPill({
  label,
  active,
  onToggle,
  children,
  isOpen,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  isOpen: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (isOpen) onToggle();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className={`inline-flex items-center gap-1 px-2 h-6 rounded-full text-xs font-medium border transition-colors ${
          active
            ? "bg-[#171717] text-white border-[#171717]"
            : "bg-white text-[#666] border-[#e0e0e0] hover:border-[#ccc] hover:text-[#171717]"
        }`}
      >
        {!active && <Plus className="h-3.5 w-3.5" />}
        {label}
        {active && <X className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-lg shadow-lg border border-[#eaeaea] overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 100;

export function TransactionTable({ transactions, timeZone }: { transactions: Transaction[]; timeZone?: string }) {
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    email: "",
    type: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [page, setPage] = useState(0);

  const toggleFilter = (key: string) => {
    if (openFilter === key) {
      setOpenFilter(null);
    } else {
      setOpenFilter(key);
    }
  };

  const applyNameFilter = () => {
    setFilters((f) => ({ ...f, name: nameInput }));
    setPage(0);
    setOpenFilter(null);
  };

  const clearNameFilter = () => {
    setFilters((f) => ({ ...f, name: "" }));
    setNameInput("");
    setPage(0);
    setOpenFilter(null);
  };

  const applyEmailFilter = () => {
    setFilters((f) => ({ ...f, email: emailInput }));
    setPage(0);
    setOpenFilter(null);
  };

  const clearEmailFilter = () => {
    setFilters((f) => ({ ...f, email: "" }));
    setEmailInput("");
    setPage(0);
    setOpenFilter(null);
  };

  const applyTypeFilter = (type: string) => {
    setFilters((f) => ({ ...f, type }));
    setPage(0);
    setOpenFilter(null);
  };

  const clearTypeFilter = () => {
    setFilters((f) => ({ ...f, type: null }));
    setPage(0);
    setOpenFilter(null);
  };

  const exportCsv = () => {
    const headers = ["Date", "Customer", "Email", "Plan", "Type", "Payment Method", "Amount"];
    const rows = filtered.map((t) => [
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
  };

  const filtered = transactions.filter((t) => {
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
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {/* Title + Filter Pills + Export */}
      <div className="sticky top-0 z-10 -mx-3 px-3 flex items-center gap-2 pb-3 mb-3 border-b border-[#eaeaea] bg-[#fafafa]">
        <h1 className="text-sm font-medium text-foreground w-[120px] shrink-0">Transactions</h1>
        <div className="flex items-center gap-1.5">
          <FilterPill
            label={filters.name ? `Name: ${filters.name}` : "Name"}
            active={!!filters.name}
            onToggle={() => (filters.name ? clearNameFilter() : toggleFilter("name"))}
            isOpen={openFilter === "name"}
          >
            <div className="p-3 w-64">
              <p className="text-sm font-semibold text-[#171717] mb-2">Filter by name</p>
              <input
                type="text"
                placeholder="contains..."
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyNameFilter()}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-[#e0e0e0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#171717] focus:border-transparent"
              />
              <button
                onClick={applyNameFilter}
                className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-[#171717] rounded-md hover:bg-black transition-colors"
              >
                Apply
              </button>
            </div>
          </FilterPill>

          <FilterPill
            label={filters.email ? `Email: ${filters.email}` : "Email"}
            active={!!filters.email}
            onToggle={() => (filters.email ? clearEmailFilter() : toggleFilter("email"))}
            isOpen={openFilter === "email"}
          >
            <div className="p-3 w-64">
              <p className="text-sm font-semibold text-[#171717] mb-2">Filter by email</p>
              <input
                type="text"
                placeholder="contains..."
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyEmailFilter()}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-[#e0e0e0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#171717] focus:border-transparent"
              />
              <button
                onClick={applyEmailFilter}
                className="w-full mt-2 px-3 py-2 text-sm font-medium text-white bg-[#171717] rounded-md hover:bg-black transition-colors"
              >
                Apply
              </button>
            </div>
          </FilterPill>

          <FilterPill
            label={filters.type ? `Type: ${TRANSACTION_TYPES.find((t) => t.value === filters.type)?.label}` : "Type"}
            active={!!filters.type}
            onToggle={() => (filters.type ? clearTypeFilter() : toggleFilter("type"))}
            isOpen={openFilter === "type"}
          >
            <div className="w-52">
              <p className="px-3 pt-3 pb-1 text-sm font-semibold text-[#171717]">Filter by type</p>
              {TRANSACTION_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => applyTypeFilter(t.value)}
                  className="w-full text-left px-3 py-2 text-sm text-[#444] hover:bg-[#f5f5f5] transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </FilterPill>
        </div>

        <div className="flex-1" />

        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-[#e0e0e0] bg-white text-[#171717] hover:border-[#ccc] transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {transactions.length === 0 ? "No transactions yet" : "No transactions match filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Date</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Customer</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Email</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Plan</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Type</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Payment method</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2 text-sm">
                        {formatTransactionDate(transaction.date, timeZone)}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium">
                        {transaction.customerName || transaction.customerEmail.split("@")[0]}
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {transaction.customerEmail}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        {transaction.description}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            transaction.type === "PAYMENT"
                              ? "bg-green-100 text-green-700"
                              : transaction.type === "SUBSCRIPTION_CREATED"
                              ? "bg-blue-100 text-blue-700"
                              : transaction.type === "VOIDED"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {transaction.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <PaymentMethod brand={transaction.paymentMethodBrand} last4={transaction.paymentMethodLast4} />
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-medium">
                        {transaction.amount > 0
                          ? formatCurrency(transaction.amount, transaction.currency)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="sticky bottom-0 -mx-3 px-3 flex items-center justify-between h-10 border-t border-[#eaeaea] bg-[#fafafa] text-xs text-muted-foreground">
        <span>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 h-7 rounded-md border border-[#e0e0e0] bg-white text-[#171717] text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#ccc] transition-colors"
            >
              Previous
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 h-7 rounded-md border border-[#e0e0e0] bg-white text-[#171717] text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-[#ccc] transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  );
}
