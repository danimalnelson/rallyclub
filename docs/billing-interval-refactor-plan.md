# Billing Interval Refactor Plan

**Date:** 2025-11-16  
**Branch:** `feature/plan-logic-enhancements`  
**Goal:** Move `interval` and `intervalCount` from Plan → Membership level

---

## 📋 Current State Analysis

### Current Schema:
```prisma
model Membership {
  billingAnchor       BillingAnchor    @default(IMMEDIATE)
  cohortBillingDay    Int?             // 1-28
  chargeImmediately   Boolean          @default(true)
  // NO interval field ❌
}

model Plan {
  interval            PriceInterval    // WEEK, MONTH, YEAR
  intervalCount       Int              @default(1)
  // Each plan stores its own interval ❌
}
```

### Problems:
1. ❌ **Redundancy**: Every plan repeats the same interval
2. ❌ **Inconsistency**: Plans in same membership could theoretically have different intervals
3. ❌ **UX Confusion**: Business sets billing frequency per-plan instead of per-membership
4. ❌ **Future-proofing**: Can't easily offer "monthly club" vs "quarterly club"

---

## 🎯 Target State

### New Schema:
```prisma
model Membership {
  billingAnchor       BillingAnchor    @default(IMMEDIATE)
  billingInterval     PriceInterval    @default(MONTH)  // NEW
  cohortBillingDay    Int?             // 1 for MVP (hardcoded)
  chargeImmediately   Boolean          @default(true)
}

model Plan {
  // Remove interval and intervalCount
  // Inherit from membership.billingInterval
}
```

### Benefits:
1. ✅ **Single source of truth**: Billing frequency set at membership level
2. ✅ **Consistency**: All plans in membership bill at same frequency
3. ✅ **Cleaner UX**: "Join our monthly wine club" (not "monthly plan")
4. ✅ **Scalable**: Easy to add quarterly/annual memberships later

---

## 🔍 Stripe Documentation Review

### Stripe Price Object:
```typescript
{
  recurring: {
    interval: "day" | "week" | "month" | "year",
    interval_count: number,  // e.g., 1, 2, 3
  }
}
```

**Key Points:**
- ✅ Prices are immutable (can't change interval after creation)
- ✅ `interval` + `interval_count` define billing frequency
- ✅ Examples:
  - Monthly: `interval: "month"`, `interval_count: 1`
  - Quarterly: `interval: "month"`, `interval_count: 3`
  - Annually: `interval: "year"`, `interval_count: 1`

**For MVP:**
- Use `interval: "month"`, `interval_count: 1` (always monthly)
- Store as `billingInterval: MONTH` on Membership
- Future: Add QUARTER (3 months), YEAR (12 months)

---

### Stripe Subscription with Billing Anchor:
```typescript
stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],  // Price already has interval defined
  
  // Billing anchor (for cohort billing)
  billing_cycle_anchor: timestamp,  // Unix timestamp
  // OR
  billing_cycle_anchor_config: {
    day_of_month: 1,  // 1-31
  },
})
```

**Key Points:**
- ✅ `billing_cycle_anchor` overrides when billing happens
- ✅ Doesn't change the interval frequency (still monthly if Price is monthly)
- ✅ Just synchronizes WHEN the billing occurs

---

## 📝 Implementation Checklist

### 1. Schema Changes ✅

**File:** `packages/db/prisma/schema.prisma`

```prisma
model Membership {
  // ... existing fields
  
  // Billing Settings (ALL AT MEMBERSHIP LEVEL)
  billingInterval     PriceInterval       @default(MONTH)  // NEW
  billingAnchor       BillingAnchor       @default(IMMEDIATE)
  cohortBillingDay    Int?                // Always 1 for MVP
  chargeImmediately   Boolean             @default(true)
  
  // ... rest
}

model Plan {
  // ... existing fields
  
  // REMOVE THESE:
  // interval            PriceInterval
  // intervalCount       Int
  
  // ... rest
}
```

**Migration Strategy:**
- Add `billingInterval` to Membership (default MONTH)
- Remove `interval` and `intervalCount` from Plan
- **Data migration:** All existing memberships get `billingInterval: MONTH`

---

### 2. UI Changes

#### A. MembershipForm (`apps/web/src/components/memberships/MembershipForm.tsx`)

**Add billing interval selector:**

```tsx
<Card>
  <CardHeader>
    <CardTitle>Billing Configuration</CardTitle>
  </CardHeader>
  <CardContent className="space-y-6">
    
    {/* NEW: Billing Frequency */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Billing Frequency <span className="text-red-500">*</span>
      </label>
      <select 
        value={billingInterval} 
        onChange={(e) => setBillingInterval(e.target.value)}
        className="w-full px-3 py-2 border rounded-md"
      >
        <option value="MONTH">Monthly</option>
        {/* Future: <option value="QUARTER">Quarterly</option> */}
        {/* Future: <option value="YEAR">Annually</option> */}
      </select>
      <p className="text-sm text-muted-foreground mt-1">
        All plans in this membership will bill at this frequency
      </p>
    </div>
    
    {/* Update examples to say "monthly" */}
    <div>
      <label className="block text-sm font-medium mb-3">
        How should members start and be billed?
      </label>
      
      {/* Option 1: Rolling */}
      <label>
        <div className="font-semibold mb-1">Rolling Membership</div>
        <div className="text-sm text-muted-foreground">
          Members start and are charged immediately. Each member is
          billed monthly on their signup date.
        </div>
        <div className="text-sm text-muted-foreground mt-2 italic">
          Example: April 15 signup → Charged $20 → Billed every 15th
        </div>
      </label>
      
      {/* Option 2: Cohort Immediate */}
      <label>
        <div className="font-semibold mb-1">Cohort Membership (Immediate Access)</div>
        <div className="text-sm text-muted-foreground">
          Members start and are charged immediately. All members are
          then billed together on the 1st of each month.
        </div>
        <div className="text-sm text-muted-foreground mt-2 italic">
          Example: April 15 signup → Charged $20 → Next bill May 1
        </div>
      </label>
      
      {/* Option 3: Cohort Deferred */}
      <label>
        <div className="font-semibold mb-1">Cohort Membership (Deferred Start)</div>
        <div className="text-sm text-muted-foreground">
          Members wait until the next billing date. Payment and access
          both begin on the 1st of the month.
        </div>
        <div className="text-sm text-muted-foreground mt-2 italic">
          Example: April 15 signup → Starts May 1 → Charged $20
        </div>
      </label>
    </div>
    
  </CardContent>
</Card>
```

**Remove day selector (hardcode to 1):**
- Remove the `<select>` for cohort billing day
- Auto-set `cohortBillingDay = 1` in submission

---

#### B. PlanForm (`apps/web/src/components/plans/PlanForm.tsx`)

**Remove entire billing frequency section:**

```tsx
// DELETE THIS:
<div className="p-3 bg-muted/50 rounded-md">
  <p className="text-sm text-muted-foreground">
    <strong>Billing Frequency:</strong> All plans are billed <strong>monthly</strong>
  </p>
</div>

// Plans inherit billing from membership - no UI needed
```

---

### 3. API Route Changes

#### A. Plan Create (`apps/web/src/app/api/plans/create/route.ts`)

**Changes:**

```typescript
// OLD:
const stripePrice = await createConnectedPrice(
  membership.business.stripeAccountId,
  {
    productId: stripeProduct.id,
    unitAmount: data.basePrice,
    currency: data.currency,
    interval: data.interval.toLowerCase(),  // ❌ From plan
    intervalCount: data.intervalCount,      // ❌ From plan
  }
);

// NEW:
const stripePrice = await createConnectedPrice(
  membership.business.stripeAccountId,
  {
    productId: stripeProduct.id,
    unitAmount: data.basePrice,
    currency: data.currency,
    interval: membership.billingInterval.toLowerCase(),  // ✅ From membership
    intervalCount: 1,  // ✅ Always 1 (monthly = 1 month)
  }
);

// Remove interval/intervalCount from plan creation:
const plan = await prisma.plan.create({
  data: {
    // ... other fields
    // ❌ Remove: interval, intervalCount
  },
});
```

---

#### B. Plan Update (`apps/web/src/app/api/plans/[planId]/route.ts`)

**Changes:**

```typescript
// OLD: Check if interval changed
const intervalChanged =
  (data.interval && data.interval !== existingPlan.interval) ||
  (data.intervalCount && data.intervalCount !== existingPlan.intervalCount);

// NEW: Interval never changes (comes from membership)
// Remove intervalChanged check entirely

// When creating new price (if basePrice changed):
const newPrice = await createConnectedPrice(
  existingPlan.business.stripeAccountId,
  {
    productId: existingPlan.stripeProductId,
    unitAmount: data.basePrice || existingPlan.basePrice || 0,
    currency: data.currency || existingPlan.currency,
    interval: existingPlan.membership.billingInterval.toLowerCase(),  // ✅ From membership
    intervalCount: 1,  // ✅ Always 1
  }
);
```

---

#### C. Subscription Confirm (`apps/web/src/app/api/checkout/[slug]/[planId]/confirm/route.ts`)

**No changes needed!** ✅

Already uses `plan.stripePriceId` which contains the interval.

**BUT we need to fix the Cohort Immediate bug:**

```typescript
// CURRENT (WRONG):
if (plan.membership.billingAnchor === "NEXT_INTERVAL" && plan.membership.cohortBillingDay) {
  subscriptionParams.billing_cycle_anchor_config = {
    day_of_month: plan.membership.cohortBillingDay,
  };
  subscriptionParams.proration_behavior = "none";  // ❌ This skips May 1!
  
  if (!plan.membership.chargeImmediately) {
    subscriptionParams.trial_end = ...;
  }
}

// NEW (CORRECT):
if (plan.membership.billingAnchor === "NEXT_INTERVAL" && plan.membership.cohortBillingDay) {
  const nextCohortDate = calculateNextCohortDate(plan.membership.cohortBillingDay);
  
  if (plan.membership.chargeImmediately) {
    // Option 2: Cohort Immediate
    // Charge now for current month, then on cohort day
    subscriptionParams.billing_cycle_anchor = Math.floor(nextCohortDate.getTime() / 1000);
    // DON'T set proration_behavior - allow immediate charge + next bill on anchor
  } else {
    // Option 3: Cohort Deferred
    // Trial until cohort day
    subscriptionParams.trial_end = Math.floor(nextCohortDate.getTime() / 1000);
    subscriptionParams.billing_cycle_anchor_config = {
      day_of_month: plan.membership.cohortBillingDay,
    };
  }
}
```

---

### 4. Database Migration

**Run:**
```bash
pnpm db:push
```

**What happens:**
- Adds `billingInterval` to Membership (defaults to MONTH for existing)
- Removes `interval` and `intervalCount` from Plan
- Prisma Client regenerates

**Data Check:**
- All existing memberships get `billingInterval: MONTH` ✅
- Existing plans lose interval fields (they inherit from membership) ✅
- Existing Stripe Prices are unaffected (immutable) ✅

---

### 5. Testing Checklist

#### Test 1: Create New Membership
- [ ] Create membership with monthly billing
- [ ] Verify `billingInterval: MONTH` saved
- [ ] Verify cohortBillingDay = 1 if cohort selected

#### Test 2: Create New Plan
- [ ] Create plan under monthly membership
- [ ] Verify Stripe Price created with `interval: "month"`, `interval_count: 1`
- [ ] Verify plan doesn't have interval fields in DB

#### Test 3: Edit Existing Plan
- [ ] Edit plan price
- [ ] Verify new Stripe Price created with correct interval (from membership)
- [ ] Verify old price archived

#### Test 4: Three Billing Models
- [ ] **Rolling:** April 15 signup → Charge $20 → Bill May 15
- [ ] **Cohort Immediate:** April 15 signup → Charge $20 → Bill May 1 ✅ FIX THIS
- [ ] **Cohort Deferred:** April 15 signup → Trial → Bill May 1

#### Test 5: Stripe Dashboard
- [ ] Check Subscription shows correct interval
- [ ] Check Price shows `recurring.interval: "month"`
- [ ] Check next billing date is correct

---

## 🚨 Breaking Changes

### For Existing Data:
- ✅ **No breaking changes** - all existing data migrates safely
- ✅ Existing Stripe Prices unchanged (still monthly)
- ✅ Existing subscriptions unchanged

### For API Consumers:
- ❌ **Breaking:** `plan.interval` and `plan.intervalCount` no longer exist
- ✅ **Use instead:** `plan.membership.billingInterval`

---

## 🎯 Rollout Plan

1. ✅ Schema changes + migration
2. ✅ Update MembershipForm UI
3. ✅ Update PlanForm UI (remove billing frequency)
4. ✅ Update API routes (create, update)
5. ✅ Fix Cohort Immediate billing bug
6. ✅ Update form interfaces/types
7. ✅ Run TypeScript build
8. ✅ Test all three billing scenarios
9. ✅ Push to Vercel
10. ✅ Verify production

---

## 📄 Files to Change

### Schema:
- ✅ `packages/db/prisma/schema.prisma`

### Components:
- ✅ `apps/web/src/components/memberships/MembershipForm.tsx`
- ✅ `apps/web/src/components/plans/PlanForm.tsx`

### API Routes:
- ✅ `apps/web/src/app/api/plans/create/route.ts`
- ✅ `apps/web/src/app/api/plans/[planId]/route.ts`
- ✅ `apps/web/src/app/api/checkout/[slug]/[planId]/confirm/route.ts` (bug fix)

### Pages:
- ✅ `apps/web/src/app/app/[businessId]/plans/[planId]/edit/page.tsx`

---

## ✅ Ready to Implement

All research complete! Let's proceed with implementation.


