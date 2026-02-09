"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@wine-club/ui";
import { Plus } from "lucide-react";
import {
  DataTable,
  useDataTable,
  StatusBadge,
  type Column,
  type FilterConfig,
} from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { PlanForm } from "./PlanForm";

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
  if (filters.status && !filters.status.split(",").includes(p.status)) return false;
  if (filters.membership && !filters.membership.split(",").includes(p.membershipName)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Membership {
  id: string;
  name: string;
  billingAnchor: string;
  cohortBillingDay?: number | null;
  status: string;
}

export function PlansTable({
  plans,
  allMembershipNames,
  businessId,
  businessSlug,
  memberships,
}: {
  plans: Plan[];
  allMembershipNames: string[];
  businessId: string;
  businessSlug: string;
  memberships: Membership[];
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  <>
    <DataTable
      title="Plans"
      columns={columns}
      data={plans}
      keyExtractor={(p) => p.id}
      filterFn={filterFn}
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
      emptyMessage="No plans yet. Create a membership first, then add plans."
      filteredEmptyMessage="No plans match filters"
      actions={
        <button
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium border border-[#e0e0e0] bg-white text-[#171717] hover:border-[#ccc] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Create plan
        </button>
      }
    />

    <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Create plan">
      <PlanForm
        businessId={businessId}
        memberships={memberships}
        onSuccess={() => {
          setDrawerOpen(false);
          router.refresh();
        }}
      />
    </Drawer>
  </>
  );
}
