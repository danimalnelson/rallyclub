"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@wine-club/ui";
import { Button, Card, CardContent } from "@wine-club/ui";
import { Plus, Pencil } from "geist-icons";
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
// Component
// ---------------------------------------------------------------------------

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
        <h1 className="text-sm font-medium text-foreground shrink-0">Plans</h1>
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
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <MembershipSection
              key={group.id}
              group={group}
              planCount={group.plans.length}
              onMembershipClick={() => setEditingMembership(group)}
              onPlanClick={(plan) => setEditingPlan({ plan, group })}
            />
          ))}
        </div>
      )}

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
// Membership section: title above plan list
// ---------------------------------------------------------------------------

function MembershipSection({
  group,
  planCount,
  onMembershipClick,
  onPlanClick,
}: {
  group: MembershipGroup;
  planCount: number;
  onMembershipClick: () => void;
  onPlanClick: (plan: Plan) => void;
}) {
  return (
    <div>
      {/* Membership header */}
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-sm font-medium">{group.name}</h2>
        <button
          onClick={onMembershipClick}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
      </div>

      {/* Plan rows */}
      <Card className="shadow-none overflow-hidden">
        <CardContent className="p-0">
          <table className="w-full">
            <tbody className="[&>tr:last-child]:border-b-0">
              {group.plans.map((plan) => (
                <tr
                  key={plan.id}
                  className="h-[42px] hover:bg-gray-100 active:bg-gray-300 cursor-pointer border-b transition-colors"
                  onClick={() => onPlanClick(plan)}
                >
                  <td className="pl-3 pr-3 text-sm font-medium">{plan.name}</td>
                  <td className="px-3 text-sm capitalize">{plan.status.toLowerCase()}</td>
                  <td className="px-3 text-sm text-right font-medium">
                    {plan.pricingType === "FIXED" && plan.price
                      ? formatCurrency(plan.price, plan.currency)
                      : "Dynamic"}
                  </td>
                  <td className="px-3 text-sm text-right font-medium">{plan.subscriptionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center h-10 px-3 border-t border-gray-400 text-xs text-muted-foreground">
            {planCount} {planCount === 1 ? "plan" : "plans"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
