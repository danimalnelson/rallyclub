"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@wine-club/ui";
import { Button, Card, CardContent } from "@wine-club/ui";
import { Plus } from "geist-icons";
import { CornerDownRight } from "@/components/icons/CornerDownRight";
import {
  useDataTable,
  StatusBadge,
  FilterPillFromConfig,
  type FilterConfig,
} from "@/components/ui/data-table";
import { Drawer } from "@wine-club/ui";
import { PlanForm } from "./PlanForm";
import { MembershipForm } from "@/components/memberships/MembershipForm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  membershipId: string;
  name: string;
  description: string;
  status: string;
  price: number | null;
  currency: string;
  pricingType: string;
  setupFee: number | null;
  recurringFee: number | null;
  recurringFeeName: string | null;
  shippingFee: number | null;
  stockStatus: string;
  maxSubscribers: number | null;
  subscriptionCount: number;
}

export interface MembershipGroup {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: string;
  billingInterval: string;
  billingAnchor: string;
  cohortBillingDay: number | null;
  chargeImmediately: boolean;
  allowMultiplePlans: boolean;
  maxMembers: number | null;
  giftEnabled: boolean;
  waitlistEnabled: boolean;
  membersOnlyAccess: boolean;
  pauseEnabled: boolean;
  skipEnabled: boolean;
  benefits: any;
  displayOrder: number;
  plans: Plan[];
}

// For PlanForm's membership prop
interface MembershipOption {
  id: string;
  name: string;
  billingAnchor: string;
  cohortBillingDay?: number | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBilling(m: MembershipGroup) {
  const interval = m.billingInterval.toLowerCase() + "ly";
  if (m.billingAnchor === "IMMEDIATE") return `${interval}, rolling`;
  return `${interval}, cohort (day ${m.cohortBillingDay})`;
}

// Flatten all plans with membership context for filtering
interface FlatPlan extends Plan {
  membershipName: string;
  membershipId: string;
}

function flattenPlans(groups: MembershipGroup[]): FlatPlan[] {
  return groups.flatMap((g) =>
    g.plans.map((p) => ({ ...p, membershipName: g.name, membershipId: g.id }))
  );
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

function filterFn(p: FlatPlan, filters: Record<string, string>): boolean {
  if (filters.name && !p.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
  if (filters.status && !filters.status.split(",").includes(p.status)) return false;
  if (filters.membership && !filters.membership.split(",").includes(p.membershipName)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function TableFooter({ count }: { count: number }) {
  return (
    <div
      key={count}
      className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center justify-between h-10 border-t border-gray-400 bg-ds-background-200 text-xs text-muted-foreground"
    >
      <span>{`${count} ${count === 1 ? "plan" : "plans"}`}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PLAN_COLUMNS = ["Plan name", "Price", "Subscribers"];

export function PlansAndMembershipsTable({
  groups,
  businessId,
  businessSlug,
}: {
  groups: MembershipGroup[];
  businessId: string;
  businessSlug: string;
}) {
  const router = useRouter();
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [membershipDrawerOpen, setMembershipDrawerOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<MembershipGroup | null>(null);
  const [editingPlan, setEditingPlan] = useState<{ plan: Plan; group: MembershipGroup } | null>(null);

  const allMembershipNames = [...new Set(groups.map((g) => g.name))].sort();
  const filterConfigs = buildFilterConfigs(allMembershipNames);

  // Flatten plans for filtering
  const allPlans = flattenPlans(groups);

  const table = useDataTable({
    data: allPlans,
    filters: filterConfigs,
    filterFn,
  });

  // Build active filters
  const activeFilters: Record<string, string> = {};
  for (const [k, v] of Object.entries(table.filterValues)) {
    if (v) activeFilters[k] = v;
  }
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  // Filter and group
  const filteredGroups = groups
    .map((g) => ({
      ...g,
      plans: hasActiveFilters
        ? g.plans.filter((p) =>
            filterFn({ ...p, membershipName: g.name, membershipId: g.id }, activeFilters)
          )
        : g.plans,
    }))
    .filter((g) => g.plans.length > 0);

  const totalPlanCount = filteredGroups.reduce((sum, g) => sum + g.plans.length, 0);
  const totalPlanCountAll = groups.reduce((sum, g) => sum + g.plans.length, 0);

  // Memberships for PlanForm drawer
  const membershipOptions: MembershipOption[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    billingAnchor: g.billingAnchor,
    cohortBillingDay: g.cohortBillingDay,
    status: g.status,
  }));

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-3 px-3 pt-3 flex items-center gap-2 pb-3 mb-3 border-b border-gray-400 bg-ds-background-200">
        <h1 className="text-sm font-medium text-foreground w-[120px] shrink-0">Plans</h1>
        <div className="flex items-center gap-1">
          {filterConfigs.map((config) => (
            <FilterPillFromConfig
              key={config.key}
              config={config}
              value={table.filterValues[config.key] || ""}
              inputValue={table.inputValues[config.key] || ""}
              isOpen={table.openFilter === config.key}
              onToggle={() => {
                const v = table.filterValues[config.key];
                if (v) {
                  table.clearFilter(config.key);
                } else {
                  table.toggleFilter(config.key);
                }
              }}
              onApplyText={() => table.applyTextFilter(config.key)}
              onApplySelect={(value) => table.applySelectFilter(config.key, value)}
              onSetInput={(value) => table.setInput(config.key, value)}
            />
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            onClick={() => setMembershipDrawerOpen(true)}
            prefix={<Plus className="h-3.5 w-3.5" />}
          >
            Create membership
          </Button>
          <Button
            onClick={() => setPlanDrawerOpen(true)}
            prefix={<Plus className="h-3.5 w-3.5" />}
          >
            Create plan
          </Button>
        </div>
      </div>

      {/* Table */}
      {totalPlanCountAll === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No plans yet. Create a membership first, then add plans.
            </p>
          </CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No plans match filters</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody className="[&>tr:last-child]:border-b-0">
                  {filteredGroups.map((group) => (
                    <MembershipSection
                      key={group.id}
                      group={group}
                      colCount={PLAN_COLUMNS.length}
                      onMembershipClick={() => setEditingMembership(group)}
                      onPlanClick={(plan) => setEditingPlan({ plan, group })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <TableFooter count={totalPlanCount} />

      {/* Create drawers */}
      <Drawer open={planDrawerOpen} onClose={() => setPlanDrawerOpen(false)} title="Create plan">
        <PlanForm
          businessId={businessId}
          memberships={membershipOptions}
          onSuccess={() => {
            setPlanDrawerOpen(false);
            router.refresh();
          }}
          onCancel={() => setPlanDrawerOpen(false)}
        />
      </Drawer>

      <Drawer open={membershipDrawerOpen} onClose={() => setMembershipDrawerOpen(false)} title="Create membership">
        <MembershipForm
          businessId={businessId}
          onSuccess={() => {
            setMembershipDrawerOpen(false);
            router.refresh();
          }}
          onCancel={() => setMembershipDrawerOpen(false)}
        />
      </Drawer>

      {/* Edit membership drawer */}
      <Drawer
        open={!!editingMembership}
        onClose={() => setEditingMembership(null)}
        title="Edit membership"
      >
        {editingMembership && (
          <MembershipForm
            key={editingMembership.id}
            businessId={businessId}
            membership={editingMembership}
            onSuccess={() => {
              setEditingMembership(null);
              router.refresh();
            }}
            onCancel={() => setEditingMembership(null)}
          />
        )}
      </Drawer>

      {/* Edit plan drawer */}
      <Drawer
        open={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        title="Edit plan"
      >
        {editingPlan && (
          <PlanForm
            key={editingPlan.plan.id}
            businessId={businessId}
            memberships={membershipOptions}
            planId={editingPlan.plan.id}
            initialData={{
              membershipId: editingPlan.plan.membershipId,
              name: editingPlan.plan.name,
              description: editingPlan.plan.description,
              pricingType: editingPlan.plan.pricingType as "FIXED" | "DYNAMIC",
              basePrice: editingPlan.plan.price ? (editingPlan.plan.price / 100).toString() : "",
              currency: editingPlan.plan.currency,
              interval: "MONTH",
              intervalCount: 1,
              setupFee: editingPlan.plan.setupFee ? (editingPlan.plan.setupFee / 100).toString() : "",
              recurringFee: editingPlan.plan.recurringFee ? (editingPlan.plan.recurringFee / 100).toString() : "",
              recurringFeeName: editingPlan.plan.recurringFeeName || "",
              shippingFee: editingPlan.plan.shippingFee ? (editingPlan.plan.shippingFee / 100).toString() : "",
              stockStatus: editingPlan.plan.stockStatus as any,
              maxSubscribers: editingPlan.plan.maxSubscribers?.toString() || "",
              status: editingPlan.plan.status as any,
            }}
            onSuccess={() => {
              setEditingPlan(null);
              router.refresh();
            }}
            onCancel={() => setEditingPlan(null)}
          />
        )}
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Membership section header + plan rows
// ---------------------------------------------------------------------------

function MembershipSection({
  group,
  colCount,
  onMembershipClick,
  onPlanClick,
}: {
  group: MembershipGroup;
  colCount: number;
  onMembershipClick: () => void;
  onPlanClick: (plan: Plan) => void;
}) {
  return (
    <>
      {/* Membership row */}
      <tr
        className="h-[42px] bg-white border-b cursor-pointer hover:bg-gray-100 active:bg-gray-300 transition-colors"
        onClick={onMembershipClick}
      >
        <td colSpan={colCount} className="px-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {group.name}
            </span>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <StatusBadge status={group.status} />
              <span>{formatBilling(group)}</span>
              <span>{group.maxMembers ? `${group.maxMembers} max` : "Unlimited"}</span>
            </div>
          </div>
        </td>
      </tr>

      {/* Plan rows (indented) */}
      {group.plans.map((plan) => (
        <tr
          key={plan.id}
          className="h-[42px] hover:bg-gray-100 active:bg-gray-300 cursor-pointer border-b transition-colors"
          onClick={() => onPlanClick(plan)}
        >
          <td className="pl-3 pr-3 text-sm font-medium">
            <div className="flex items-center gap-2">
              <CornerDownRight size={16} className="shrink-0 text-gray-700" />
              {plan.name}
              <StatusBadge status={plan.status} />
            </div>
          </td>
          <td className="px-3 text-sm text-right font-medium">
            {plan.pricingType === "FIXED" && plan.price
              ? formatCurrency(plan.price, plan.currency)
              : "Dynamic"}
          </td>
          <td className="px-3 text-sm text-right font-medium">{plan.subscriptionCount}</td>
        </tr>
      ))}
    </>
  );
}
