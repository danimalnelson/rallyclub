"use client";

import { formatCurrency } from "@wine-club/ui";
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

export interface Plan {
  id: string;
  name: string;
  status: string;
  membershipName: string;
  price: number | null;
  currency: string;
  pricingType: string;
  frequency: string;
  subscriptionCount: number;
}

// ---------------------------------------------------------------------------
// Filter config
// ---------------------------------------------------------------------------

function buildFilterConfigs(allMembershipNames: string[]): FilterConfig[] {
  return [
    { type: "text", key: "name", label: "Name" },
    {
      type: "select",
      key: "status",
      label: "Status",
      options: [
        { value: "ACTIVE", label: "Active" },
        { value: "DRAFT", label: "Draft" },
        { value: "ARCHIVED", label: "Archived" },
      ],
    },
    {
      type: "select",
      key: "membership",
      label: "Membership",
      options: allMembershipNames.map((n) => ({ value: n, label: n })),
    },
  ];
}

function filterFn(p: Plan, filters: Record<string, string>): boolean {
  if (filters.name && !p.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  if (filters.status && p.status !== filters.status) return false;
  if (filters.membership && p.membershipName !== filters.membership) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlansTable({
  plans,
  allMembershipNames,
  businessSlug,
}: {
  plans: Plan[];
  allMembershipNames: string[];
  businessSlug: string;
}) {
  const filterConfigs = buildFilterConfigs(allMembershipNames);

  const table = useDataTable({
    data: plans,
    filters: filterConfigs,
    filterFn,
  });

  const columns: Column<Plan>[] = [
    {
      key: "name",
      label: "Plan name",
      cellClassName: "font-medium",
      render: (p) => p.name,
    },
    {
      key: "status",
      label: "Status",
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "membership",
      label: "Membership",
      cellClassName: "text-muted-foreground",
      render: (p) => p.membershipName,
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      cellClassName: "font-medium",
      render: (p) =>
        p.pricingType === "FIXED" && p.price ? formatCurrency(p.price, p.currency) : "Dynamic",
    },
    {
      key: "frequency",
      label: "Frequency",
      cellClassName: "text-muted-foreground capitalize",
      render: (p) => `${p.frequency.toLowerCase()}ly`,
    },
    {
      key: "subscriptions",
      label: "Subscriptions",
      align: "right",
      cellClassName: "font-medium",
      render: (p) => p.subscriptionCount,
    },
  ];

  return (
    <DataTable
      title="Plans"
      columns={columns}
      data={plans}
      filtered={table.filtered}
      paginated={table.paginated}
      keyExtractor={(p) => p.id}
      onRowClick={(p) => {
        window.location.href = `/app/${businessSlug}/plans/${p.id}/edit`;
      }}
      filterConfigs={filterConfigs}
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
      emptyMessage="No plans yet. Create a membership first, then add plans."
      filteredEmptyMessage="No plans match filters"
      resultLabel="plan"
      actions={
        <Link
          href={`/app/${businessSlug}/plans/create`}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-[#e0e0e0] bg-white text-[#171717] hover:border-[#ccc] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create plan
        </Link>
      }
    />
  );
}
