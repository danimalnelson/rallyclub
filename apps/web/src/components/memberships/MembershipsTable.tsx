"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBilling(m: Membership) {
  const interval = m.billingInterval.toLowerCase() + "ly";
  if (m.billingAnchor === "IMMEDIATE") return `${interval}, rolling`;
  return `${interval}, cohort (day ${m.cohortBillingDay})`;
}

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

const FILTER_CONFIGS: FilterConfig[] = [
  { type: "text", key: "name", label: "Name" },
  {
    type: "select",
    key: "status",
    label: "Status",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "DRAFT", label: "Draft" },
      { value: "PAUSED", label: "Paused" },
      { value: "ARCHIVED", label: "Archived" },
    ],
  },
];

function filterFn(m: Membership, filters: Record<string, string>): boolean {
  if (filters.name && !m.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  if (filters.status && m.status !== filters.status) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MembershipsTable({
  memberships,
  businessSlug,
}: {
  memberships: Membership[];
  businessSlug: string;
}) {
  const table = useDataTable({
    data: memberships,
    filters: FILTER_CONFIGS,
    filterFn,
  });

  const columns: Column<Membership>[] = [
    {
      key: "name",
      label: "Name",
      cellClassName: "font-medium",
      render: (m) => m.name,
    },
    {
      key: "status",
      label: "Status",
      render: (m) => <StatusBadge status={m.status} />,
    },
    {
      key: "billing",
      label: "Billing",
      cellClassName: "text-muted-foreground capitalize",
      render: (m) => formatBilling(m),
    },
    {
      key: "plans",
      label: "Plans",
      align: "right",
      render: (m) => (
        <>
          <span className="font-medium">{m.activePlans}</span>
          <span className="text-muted-foreground"> / {m.totalPlans}</span>
        </>
      ),
    },
    {
      key: "capacity",
      label: "Capacity",
      align: "right",
      cellClassName: "text-muted-foreground",
      render: (m) => m.maxMembers ?? "Unlimited",
    },
  ];

  return (
    <DataTable
      title="Memberships"
      columns={columns}
      data={memberships}
      filtered={table.filtered}
      paginated={table.paginated}
      keyExtractor={(m) => m.id}
      onRowClick={(m) => {
        window.location.href = `/app/${businessSlug}/memberships/${m.id}/edit`;
      }}
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
      emptyMessage="No memberships yet. Create your first membership to start offering subscription plans."
      filteredEmptyMessage="No memberships match filters"
      resultLabel="membership"
      actions={
        <Link
          href={`/app/${businessSlug}/memberships/create`}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-[#e0e0e0] bg-white text-[#171717] hover:border-[#ccc] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create membership
        </Link>
      }
    />
  );
}
