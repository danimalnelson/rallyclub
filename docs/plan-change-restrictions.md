# Plan Change Restrictions

## Overview

Certain plan configuration changes are complex or impossible to apply retroactively to existing subscriptions. This document outlines which changes should be restricted and why.

## Restrictions

### 1. ❌ Billing Model Changes (RESTRICTED)

**Location:** Membership settings (applies to all plans in membership)

**Restricted Changes:**
- `billingAnchor`: IMMEDIATE ↔ NEXT_INTERVAL
- `chargeImmediately`: true ↔ false
- `cohortBillingDay`: Changing the day

**Why Restricted:**

#### Rolling → Cohort (IMMEDIATE → NEXT_INTERVAL)
```
Problem: Existing subscriptions have individual billing dates

Customer A: Bills on May 1 (anniversary)
Customer B: Bills on May 15 (anniversary)

Business changes to cohort billing (day 1)

What should happen?
- Move everyone to bill on 1st? (requires updating billing_cycle_anchor)
- Prorate? Give credit? Charge extra?
- Immediate change or wait for next renewal?

Complexity:
- Update Stripe subscription.billing_cycle_anchor for each sub
- Handle prorations (may charge or credit customers)
- Risk of customer confusion ("why did my billing date change?")
- May require customer notification and consent
```

#### Cohort → Rolling (NEXT_INTERVAL → IMMEDIATE)
```
Problem: We don't store original signup dates

All customers currently bill on cohort day (e.g., 1st)
Business changes to rolling billing

What should happen?
- Keep everyone on 1st? (not true "rolling")
- Assign random dates? (unfair)
- Use date of change as new anniversary? (arbitrary)

Complexity:
- No way to restore original signup dates
- Not true "rolling" billing anymore
- Potentially confusing for customers
```

#### Cohort Immediate ↔ Cohort Deferred
```
Problem: Can't retroactively change how customers were charged

Existing customers: Already paid upfront
New setting: Trial period before first charge

What should happen?
- Setting only affects new signups? (inconsistent)
- Refund existing customers and put on trial? (complicated)
- Wait until next renewal? (confusing)

Complexity:
- Can't change past billing behavior
- Creates two classes of customers
- May require refunds or credits
```

**Solution:** Disable billing model changes when active subscriptions exist

### 2. ⚠️ Pricing Type Changes (NEEDS HANDLING)

**Location:** Plan settings

**Changes:**
- `pricingType`: FIXED ↔ DYNAMIC

**Current Issues:**

#### Fixed → Dynamic
```
Existing subscriptions: Have fixed stripePriceId
Plan changes to: DYNAMIC with monthly prices

At next billing:
- invoice.created webhook fires
- Plan is now "DYNAMIC"
- getCurrentPriceForDate() finds current month's price
- Webhook updates subscription
✅ Works! (webhook handles it)
```

#### Dynamic → Fixed
```
Existing subscriptions: Have dynamic stripePriceIds
Plan changes to: FIXED with basePrice

At next billing:
- invoice.created webhook fires
- Plan is now "FIXED"
- Webhook skips dynamic pricing check
- Invoice processes with old dynamic price
❌ WRONG! Subscription never updates to fixed price
```

**Solution:** Update all subscriptions immediately when changing from DYNAMIC → FIXED

### 3. ✅ Safe Changes (NO RESTRICTIONS)

**These changes are safe and apply automatically:**

- **Plan name/description:** Metadata only
- **Stock status:** Affects new signups only
- **Max subscribers:** Affects new signups only
- **Status (DRAFT/ACTIVE/ARCHIVED):** Affects visibility only
- **Fees (setup, shipping, recurring):** Applied at checkout only
- **Within-type price changes:**
  - Fixed: Changing basePrice (webhook updates subscriptions)
  - Dynamic: Changing monthly prices (webhook updates subscriptions)

## Implementation

### 1. Restrict Billing Model Changes

**File:** `apps/web/src/app/api/memberships/[membershipId]/route.ts`

```typescript
// PUT: Update membership
export async function PUT(req, context) {
  // ... existing code ...

  // Check if billing settings are changing
  const billingSettingsChanging =
    data.billingAnchor !== undefined && data.billingAnchor !== existingMembership.billingAnchor ||
    data.chargeImmediately !== undefined && data.chargeImmediately !== existingMembership.chargeImmediately ||
    data.cohortBillingDay !== undefined && data.cohortBillingDay !== existingMembership.cohortBillingDay;

  if (billingSettingsChanging) {
    // Check for active subscriptions across all plans in this membership
    const activeSubscriptionCount = await prisma.planSubscription.count({
      where: {
        plan: {
          membershipId: membershipId,
        },
        status: {
          in: ["ACTIVE", "TRIALING", "PAUSED"],
        },
      },
    });

    if (activeSubscriptionCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot change billing settings while active subscriptions exist",
          details: `Found ${activeSubscriptionCount} active subscription(s). Cancel or wait for these to end before changing billing settings.`,
          code: "ACTIVE_SUBSCRIPTIONS_EXIST",
        },
        { status: 400 }
      );
    }
  }

  // ... rest of update logic ...
}
```

**UI:** Add warning in MembershipForm

```typescript
// In MembershipForm.tsx
const { data: subscriptionCount } = useSWR(
  `/api/memberships/${membershipId}/subscription-count`
);

{subscriptionCount > 0 && (
  <Alert variant="warning">
    <AlertIcon />
    <AlertTitle>Billing Settings Locked</AlertTitle>
    <AlertDescription>
      You have {subscriptionCount} active subscription(s). 
      Billing settings cannot be changed while subscriptions are active.
    </AlertDescription>
  </Alert>
)}

<FormField disabled={subscriptionCount > 0}>
  <Label>Billing Anchor</Label>
  <Select disabled={subscriptionCount > 0}>
    {/* ... options ... */}
  </Select>
</FormField>
```

### 2. Handle Pricing Type Changes

**File:** `apps/web/src/app/api/plans/[planId]/route.ts`

```typescript
// PUT: Update plan
export async function PUT(req, context) {
  // ... existing code ...

  // Check if pricingType is changing
  const pricingTypeChanging =
    data.pricingType !== undefined && data.pricingType !== existingPlan.pricingType;

  if (pricingTypeChanging) {
    console.log(`[Plan Update] Pricing type changing: ${existingPlan.pricingType} → ${data.pricingType}`);

    // DYNAMIC → FIXED: Update all subscriptions immediately
    if (existingPlan.pricingType === "DYNAMIC" && data.pricingType === "FIXED") {
      if (!data.basePrice) {
        return NextResponse.json(
          { error: "Must provide basePrice when changing to FIXED pricing" },
          { status: 400 }
        );
      }

      // Create new fixed price
      const fixedPrice = await createConnectedPrice(
        existingPlan.business.stripeAccountId,
        {
          productId: existingPlan.stripeProductId!,
          unitAmount: data.basePrice,
          currency: data.currency || existingPlan.currency,
          interval: existingPlan.membership.billingInterval.toLowerCase() as "week" | "month" | "year",
          intervalCount: 1,
          nickname: `${data.name || existingPlan.name} - Fixed`,
          metadata: {
            planName: data.name || existingPlan.name,
            membershipId: existingPlan.membershipId,
            pricingType: "FIXED",
          },
        }
      );

      newStripePriceId = fixedPrice.id;

      // Update ALL active subscriptions to new fixed price
      const activeSubscriptions = await prisma.planSubscription.findMany({
        where: {
          planId: existingPlan.id,
          status: { in: ["ACTIVE", "TRIALING", "PAUSED"] },
        },
      });

      console.log(`[Plan Update] Updating ${activeSubscriptions.length} subscriptions to fixed price`);

      for (const sub of activeSubscriptions) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
          
          await stripe.subscriptions.update(sub.stripeSubscriptionId, {
            items: [{
              id: stripeSub.items.data[0].id,
              price: fixedPrice.id,
            }],
            proration_behavior: "none", // Don't prorate, apply at next billing
            metadata: {
              ...stripeSub.metadata,
              pricingType: "FIXED",
              priceUpdatedAt: new Date().toISOString(),
            },
          });

          console.log(`[Plan Update] ✅ Updated subscription ${sub.id} to fixed price`);
        } catch (error) {
          console.error(`[Plan Update] ❌ Failed to update subscription ${sub.id}:`, error);
          // Continue with others
        }
      }

      // Archive old dynamic prices
      await prisma.priceQueueItem.updateMany({
        where: {
          planId: existingPlan.id,
          applied: false, // Only future prices
        },
        data: {
          applied: true, // Mark as "processed" (archived)
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          businessId: existingPlan.businessId,
          actorUserId: session.user.id,
          type: "PRICING_TYPE_CHANGED",
          metadata: {
            planId: existingPlan.id,
            from: "DYNAMIC",
            to: "FIXED",
            subscriptionsUpdated: activeSubscriptions.length,
            newPriceId: fixedPrice.id,
          },
        },
      });
    }

    // FIXED → DYNAMIC: Webhook will handle transition at next billing
    if (existingPlan.pricingType === "FIXED" && data.pricingType === "DYNAMIC") {
      if (!data.monthlyPrices || data.monthlyPrices.length === 0) {
        return NextResponse.json(
          { error: "Must provide monthlyPrices when changing to DYNAMIC pricing" },
          { status: 400 }
        );
      }

      const currentMonthPrice = data.monthlyPrices.find(mp => mp.isCurrent);
      if (!currentMonthPrice) {
        return NextResponse.json(
          { error: "Must set current month's price when changing to DYNAMIC pricing" },
          { status: 400 }
        );
      }

      // Create current month's price
      const dynamicPrice = await createConnectedPrice(
        existingPlan.business.stripeAccountId,
        {
          productId: existingPlan.stripeProductId!,
          unitAmount: currentMonthPrice.price,
          currency: data.currency || existingPlan.currency,
          interval: existingPlan.membership.billingInterval.toLowerCase() as "week" | "month" | "year",
          intervalCount: 1,
          nickname: `${data.name || existingPlan.name} - ${currentMonthPrice.month}`,
          metadata: {
            planName: data.name || existingPlan.name,
            membershipId: existingPlan.membershipId,
            effectiveMonth: currentMonthPrice.month,
            pricingType: "DYNAMIC",
          },
        }
      );

      newStripePriceId = dynamicPrice.id;

      // Note: We DON'T update existing subscriptions here
      // The webhook will handle it at their next billing cycle

      console.log(`[Plan Update] Changed to DYNAMIC pricing. Webhook will update subscriptions at next billing.`);

      // Create audit log
      await prisma.auditLog.create({
        data: {
          businessId: existingPlan.businessId,
          actorUserId: session.user.id,
          type: "PRICING_TYPE_CHANGED",
          metadata: {
            planId: existingPlan.id,
            from: "FIXED",
            to: "DYNAMIC",
            newPriceId: dynamicPrice.id,
            note: "Existing subscriptions will transition at next billing cycle via webhook",
          },
        },
      });
    }
  }

  // ... rest of existing update logic ...
}
```

## User Experience

### Billing Settings (Membership Level)

```
┌─────────────────────────────────────────────┐
│ Billing Settings                            │
├─────────────────────────────────────────────┤
│                                             │
│ ⚠️ 12 active subscriptions exist           │
│    Billing settings cannot be changed while │
│    subscriptions are active.                │
│                                             │
│ Billing Model: [Rolling ▼] 🔒              │
│                                             │
│ ☐ Charge Immediately 🔒                     │
│                                             │
│ Cohort Billing Day: [1 ▼] 🔒               │
│                                             │
└─────────────────────────────────────────────┘
```

### Pricing Type Changes (Plan Level)

**Dynamic → Fixed:**
```
┌─────────────────────────────────────────────┐
│ Confirm Pricing Type Change                 │
├─────────────────────────────────────────────┤
│ You are changing from Dynamic to Fixed      │
│ pricing.                                    │
│                                             │
│ This will:                                  │
│ • Create a new fixed price ($99.99/month)  │
│ • Update 12 active subscriptions           │
│ • Apply at their next billing cycle        │
│ • Archive all future dynamic prices        │
│                                             │
│ [Cancel]  [Confirm Change]                  │
└─────────────────────────────────────────────┘
```

**Fixed → Dynamic:**
```
┌─────────────────────────────────────────────┐
│ Confirm Pricing Type Change                 │
├─────────────────────────────────────────────┤
│ You are changing from Fixed to Dynamic      │
│ pricing.                                    │
│                                             │
│ This will:                                  │
│ • Create monthly prices starting now       │
│ • Update subscriptions at next billing     │
│ • Require setting prices each month        │
│                                             │
│ Active subscriptions: 12                    │
│ They will transition to dynamic pricing     │
│ automatically at their next billing cycle.  │
│                                             │
│ [Cancel]  [Confirm Change]                  │
└─────────────────────────────────────────────┘
```

## Summary

| Change | Allowed? | Handling |
|--------|----------|----------|
| **Billing Model** (Rolling ↔ Cohort) | ❌ Only if no active subs | Restriction + UI lock |
| **Pricing Type** (FIXED ↔ DYNAMIC) | ✅ Yes | Immediate update (D→F) or webhook (F→D) |
| **Price within type** (Fixed price or Dynamic month) | ✅ Yes | Webhook handles at next billing |
| **Plan name/description** | ✅ Yes | Metadata only |
| **Stock status, max subs** | ✅ Yes | Affects new signups only |

## Testing

### Test Billing Model Restriction

```bash
# Create membership with rolling billing
# Add plan and get subscriptions
# Try to change to cohort billing
# Expected: 400 error "Cannot change billing settings"
```

### Test DYNAMIC → FIXED

```bash
# Create dynamic plan with 3 active subscriptions
# Change to fixed pricing ($99.99)
# Check Stripe: All 3 subscriptions updated to fixed price
# Check next billing: Charges fixed price
```

### Test FIXED → DYNAMIC

```bash
# Create fixed plan with 3 active subscriptions
# Change to dynamic pricing (set monthly prices)
# Check Stripe: Subscriptions NOT updated yet
# Wait for next billing cycle
# Check webhook logs: Updates each subscription to current month's price
```

