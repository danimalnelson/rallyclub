"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@wine-club/ui";
import { Plus } from "geist-icons";
import {
  DataTable,
  useDataTable,
  StatusBadge,
  type Column,
  type FilterConfig,
} from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { MembershipForm } from "./MembershipForm";

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
  if (filters.status && !filters.status.split(",").includes(m.status)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MembershipsTable({
  memberships,
  businessId,
  businessSlug,
}: {
  memberships: Membership[];
  businessId: string;
  businessSlug: string;
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  <>
    <DataTable
      title="Memberships"
      columns={columns}
      data={memberships}
      keyExtractor={(m) => m.id}
      filterFn={filterFn}
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
      emptyMessage="No memberships yet. Create your first membership to start offering subscription plans."
      filteredEmptyMessage="No memberships match filters"
      actions={
        <Button
          type="secondary"
          onClick={() => setDrawerOpen(true)}
          prefix={<Plus className="h-3.5 w-3.5" />}
        >
          Create membership
        </Button>
      }
    />

    <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Create membership">
      <MembershipForm
        businessId={businessId}
        onSuccess={() => {
          setDrawerOpen(false);
          router.refresh();
        }}
      />
    </Drawer>
  </>
  );
}
