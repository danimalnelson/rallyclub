"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@wine-club/ui";
import { Plus, X, Download } from "lucide-react";
import Link from "next/link";

export interface Member {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE";
  joinedAt: Date;
  activePlans: string[];
}

interface FilterState {
  name: string;
  email: string;
  status: string | null;
  plan: string | null;
}

function formatJoinedDate(date: Date, timeZone?: string) {
  const d = date instanceof Date ? date : new Date(date);
  const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone }).format(d);
  const year = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(d);
  return `${month} ${day}, ${year}`;
}

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
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

export function MembersTable({
  members,
  allPlanNames,
  businessSlug,
  timeZone,
}: {
  members: Member[];
  allPlanNames: string[];
  businessSlug: string;
  timeZone?: string;
}) {
  const [filters, setFilters] = useState<FilterState>({
    name: "",
    email: "",
    status: null,
    plan: null,
  });
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
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

  const applyPlanFilter = (plan: string) => {
    setFilters((f) => ({ ...f, plan }));
    setPage(0);
    setOpenFilter(null);
  };
  const clearPlanFilter = () => {
    setFilters((f) => ({ ...f, plan: null }));
    setPage(0);
    setOpenFilter(null);
  };

  const exportCsv = () => {
    const headers = ["Name", "Email", "Status", "Joined", "Active Plans"];
    const rows = filtered.map((m) => [
      m.name.replace(/,/g, ""),
      m.email,
      m.status,
      m.joinedAt instanceof Date ? m.joinedAt.toISOString().split("T")[0] : String(m.joinedAt).split("T")[0],
      m.activePlans.join("; "),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `members-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = members.filter((m) => {
    if (filters.name && !m.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
    if (filters.email && !m.email.toLowerCase().includes(filters.email.toLowerCase())) return false;
    if (filters.status && m.status !== filters.status) return false;
    if (filters.plan && !m.activePlans.some((p) => p === filters.plan)) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {/* Title + Filter Pills + Export */}
      <div className="sticky top-0 z-10 -mx-3 px-3 flex items-center gap-2 pb-3 mb-3 border-b border-[#eaeaea] bg-[#fafafa]">
        <h1 className="text-sm font-medium text-foreground w-[120px] shrink-0">Members</h1>
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

          <FilterPill
            label={filters.plan ? `Plan: ${filters.plan}` : "Plan"}
            active={!!filters.plan}
            onToggle={() => (filters.plan ? clearPlanFilter() : toggleFilter("plan"))}
            isOpen={openFilter === "plan"}
          >
            <div className="w-64 max-h-64 overflow-y-auto">
              <p className="px-3 pt-3 pb-1 text-sm font-semibold text-[#171717]">Filter by plan</p>
              {allPlanNames.map((plan) => (
                <button
                  key={plan}
                  onClick={() => applyPlanFilter(plan)}
                  className="w-full text-left px-3 py-2 text-sm text-[#444] hover:bg-[#f5f5f5] transition-colors truncate"
                >
                  {plan}
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
              {members.length === 0
                ? "No members yet. Members will appear here when they subscribe to your plans."
                : "No members match filters"}
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
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Email</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Status</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Joined</th>
                    <th className="px-3 py-2 font-medium text-xs text-muted-foreground">Plans</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginated.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => window.location.href = `/app/${businessSlug}/members/${member.id}`}
                    >
                      <td className="px-3 py-2 text-sm font-medium">
                        {member.name}
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {member.email}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            member.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {member.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {formatJoinedDate(member.joinedAt, timeZone)}
                      </td>
                      <td className="px-3 py-2 text-sm max-w-[200px]">
                        {member.activePlans.length > 0 ? (
                          <span className="block truncate" title={member.activePlans.join(", ")}>
                            {member.activePlans.join(", ")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
        <span>{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
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
