"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, formatCurrency } from "@wine-club/ui";
import { Plus } from "geist-icons";
import {
  DataTable,
  useDataTable,
  type Column,
  type FilterConfig,
} from "@/components/ui/data-table";
import { Drawer } from "@wine-club/ui";
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
      cellClassName: "capitalize",
      render: (p) => p.status.toLowerCase(),
    },
    {
      key: "membership",
      label: "Membership",
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
      cellClassName: "capitalize",
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
      onRowClick={(p) => {
        window.location.href = `/app/${businessSlug}/plans/${p.id}/edit`;
      }}
      table={table}
      emptyMessage="No plans yet. Create a membership first, then add plans."
      filteredEmptyMessage="No plans match filters"
      actions={
        <Button
          variant="secondary"
          onClick={() => setDrawerOpen(true)}
          prefix={<Plus className="h-3.5 w-3.5" />}
        >
          Create plan
        </Button>
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
