"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@wine-club/ui";
import { Plus, X } from "lucide-react";
import Link from "next/link";

export interface Membership {
  id: string;
  name: string;
  status: string;
  billingInterval: string;
  billingAnchor: string;
  cohortBillingDay: number | null;
  totalPlans: number;
  activePlans: number;
  maxMembers: number | null;
}

interface FilterState {
  name: string;
  status: string | null;
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
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

export function MembershipsTable({
  memberships,
  businessSlug,
}: {
  memberships: Membership[];
  businessSlug: string;
}) {
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    status: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [page, setPage] = useState(0);

  const toggleFilter = (key: string) => {
    setOpenFilter(openFilter === key ? null : key);
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

  const applyStatusFilter = (status: string) => {
    setFilters((f) => ({ ...f, status }));
    setPage(0);
    setOpenFilter(null);
  };
  const clearStatusFilter = () => {
    setFilters((f) => ({ ...f, status: null }));
    setPage(0);
    setOpenFilter(null);
  };

  const filtered = memberships.filter((m) => {
    if (filters.name && !m.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.status && m.status !== filters.status) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function formatBilling(m: Membership) {
    const interval = m.billingInterval.toLowerCase() + "ly";
    if (m.billingAnchor === "IMMEDIATE") return `${interval}, rolling`;
    return `${interval}, cohort (day ${m.cohortBillingDay})`;
  }

  return (
    <>
      {/* Title + Filter Pills + Create */}
      <div className="sticky top-0 z-10 -mx-3 px-3 flex items-center gap-2 pb-3 mb-3 border-b border-[#eaeaea] bg-[#fafafa]">
        <h1 className="text-sm font-medium text-foreground w-[120px] shrink-0">Memberships</h1>
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
            label={filters.status ? `Status: ${filters.status}` : "Status"}
            active={!!filters.status}
            onToggle={() => (filters.status ? clearStatusFilter() : toggleFilter("status"))}
            isOpen={openFilter === "status"}
          >
            <div className="w-52">
              <p className="px-3 pt-3 pb-1 text-sm font-semibold text-[#171717]">Filter by status</p>
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => applyStatusFilter(s.value)}
                  className="w-full text-left px-3 py-2 text-sm text-[#444] hover:bg-[#f5f5f5] transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </FilterPill>
        </div>

        <div className="flex-1" />

        <Link
          href={`/app/${businessSlug}/memberships/create`}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-[#e0e0e0] bg-white text-[#171717] hover:border-[#ccc] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create membership
        </Link>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {memberships.length === 0
                ? "No memberships yet. Create your first membership to start offering subscription plans."
                : "No memberships match filters"}
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
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Name</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Billing</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Plans</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground text-right">Capacity</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((membership) => (
                    <tr
                      key={membership.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => window.location.href = `/app/${businessSlug}/memberships/${membership.id}/edit`}
                    >
                      <td className="px-3 py-2 text-sm font-medium">
                        {membership.name}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            membership.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : membership.status === "DRAFT"
                              ? "bg-yellow-100 text-yellow-700"
                              : membership.status === "PAUSED"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {membership.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground capitalize">
                        {formatBilling(membership)}
                      </td>
                      <td className="px-3 py-2 text-sm text-right">
                        <span className="font-medium">{membership.activePlans}</span>
                        <span className="text-muted-foreground"> / {membership.totalPlans}</span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right text-muted-foreground">
                        {membership.maxMembers ?? "Unlimited"}
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
      <div className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center justify-between h-10 border-t border-[#eaeaea] bg-[#fafafa] text-xs text-muted-foreground">
        <span>{filtered.length} membership{filtered.length !== 1 ? "s" : ""}</span>
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
