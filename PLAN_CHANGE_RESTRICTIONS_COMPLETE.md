# Plan Change Restrictions - Implementation Complete ✅

**Branch:** `feature/refine-dynamic-pricing`
**Date:** November 16, 2025

## Summary

Successfully implemented restrictions to prevent breaking changes to active subscriptions, including:
1. **Billing model changes** (rolling ↔ cohort) disabled when active subscriptions exist
2. **Pricing type changes** (fixed ↔ dynamic) handled correctly with automatic subscription updates

## Problem

Certain plan configuration changes are too complex to apply retroactively to existing subscriptions:

### 🚨 Billing Model Changes (Rolling ↔ Cohort)
- **Problem:** Impossible to migrate individual billing dates to cohort dates (or vice versa)
- **Example:** 
  - Rolling: Customer A bills on 5th, Customer B bills on 15th
  - Change to Cohort (day 1): How do we move everyone to the 1st without prorating/charging unexpectedly?
  - Change from Cohort to Rolling: We don't have original signup dates to restore
- **Solution:** Disable billing changes when subscriptions exist

### ⚠️ Pricing Type Changes (Fixed ↔ Dynamic)
- **Problem (Dynamic → Fixed):** Subscriptions never update to fixed price
- **Problem (Fixed → Dynamic):** Need to create monthly price queue items
- **Solution:** Automatically update subscriptions and handle price queue

## Implementation

### 1. API Endpoint: Subscription Count

**File:** `apps/web/src/app/api/memberships/[id]/subscription-count/route.ts`

```typescript
export const GET = withMiddleware(async (req: NextRequest, context) => {
  // Count active subscriptions across all plans in membership
  const activeCount = await prisma.planSubscription.count({
    where: {
      plan: { membershipId: id },
      status: { in: ["ACTIVE", "TRIALING", "PAUSED"] },
    },
  });

  return NextResponse.json({
    count: activeCount,
    hasActiveSubscriptions: activeCount > 0,
  });
});
```

### 2. Membership API: Billing Change Validation

**File:** `apps/web/src/app/api/memberships/[id]/route.ts`

**Added validation:**
```typescript
// Check if billing settings are changing
const billingSettingsChanging =
  (membershipData.billingAnchor !== undefined &&
    membershipData.billingAnchor !== existingMembership.billingAnchor) ||
  (membershipData.chargeImmediately !== undefined &&
    membershipData.chargeImmediately !== existingMembership.chargeImmediately) ||
  (membershipData.cohortBillingDay !== undefined &&
    membershipData.cohortBillingDay !== existingMembership.cohortBillingDay);

if (billingSettingsChanging) {
  const activeSubscriptionCount = await prisma.planSubscription.count({
    where: {
      plan: { membershipId: id },
      status: { in: ["ACTIVE", "TRIALING", "PAUSED"] },
    },
  });

  if (activeSubscriptionCount > 0) {
    return NextResponse.json(
      {
        error: "Cannot change billing settings while active subscriptions exist",
        details: `Found ${activeSubscriptionCount} active subscription(s). These subscriptions must be cancelled or expired before changing billing settings.`,
        code: "ACTIVE_SUBSCRIPTIONS_EXIST",
        activeSubscriptionCount,
      },
      { status: 400 }
    );
  }
}
```

**What this prevents:**
- ✅ Changing billingAnchor (IMMEDIATE ↔ NEXT_INTERVAL)
- ✅ Changing chargeImmediately (true ↔ false)
- ✅ Changing cohortBillingDay (1 ↔ 15)

### 3. Membership Form: UI Restrictions

**File:** `apps/web/src/components/memberships/MembershipForm.tsx`

**Changes:**
1. Added `useSWR` to fetch subscription count
2. Added warning banner when subscriptions exist
3. Disabled all billing fields when subscriptions exist

**Warning Banner:**
```tsx
{hasBillingRestriction && (
  <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0">...</svg>
      <div className="flex-1">
        <h4 className="font-semibold text-sm mb-1">
          Billing Settings Locked
        </h4>
        <p className="text-sm">
          You have <span className="font-semibold">{activeSubscriptionCount} active subscription{activeSubscriptionCount !== 1 ? "s" : ""}</span>.
          Billing settings cannot be changed while subscriptions are active.
        </p>
      </div>
    </div>
  </div>
)}
```

**Disabled Fields:**
- ✅ Billing frequency dropdown
- ✅ All billing model radio buttons (Rolling, Cohort Immediate, Cohort Deferred)

### 4. Plan API: Pricing Type Change Handling

**File:** `apps/web/src/app/api/plans/[planId]/route.ts`

#### Dynamic → Fixed

**Process:**
1. Validate `basePrice` is provided
2. Create new Stripe Price (fixed)
3. Update ALL active subscriptions to new fixed price
4. Archive future dynamic prices in queue

**Code:**
```typescript
if (existingPlan.pricingType === "DYNAMIC" && data.pricingType === "FIXED") {
  // Create new fixed price
  const fixedPrice = await createConnectedPrice(...);
  newStripePriceId = fixedPrice.id;

  // Update ALL active subscriptions
  const activeSubscriptions = await prisma.planSubscription.findMany({
    where: {
      planId: existingPlan.id,
      status: { in: ["ACTIVE", "TRIALING", "PAUSED"] },
    },
  });

  for (const sub of activeSubscriptions) {
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
    
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [{
        id: stripeSub.items.data[0].id,
        price: fixedPrice.id,
      }],
      proration_behavior: "none", // Apply at next billing
      metadata: {
        ...stripeSub.metadata,
        pricingType: "FIXED",
        priceUpdatedAt: new Date().toISOString(),
      },
    });
  }

  // Archive future dynamic prices
  await prisma.priceQueueItem.updateMany({
    where: {
      planId: existingPlan.id,
      applied: false,
    },
    data: { applied: true },
  });
}
```

**Result:**
- ✅ All subscriptions immediately updated to fixed price
- ✅ Changes apply at next billing (no proration)
- ✅ Future dynamic prices archived

#### Fixed → Dynamic

**Process:**
1. Validate `monthlyPrices` provided with current month
2. Create Stripe Price for current month
3. Create `PriceQueueItem` records for all monthly prices
4. DON'T update subscriptions (webhook handles at next billing)

**Code:**
```typescript
if (existingPlan.pricingType === "FIXED" && data.pricingType === "DYNAMIC") {
  const currentMonthPrice = data.monthlyPrices.find((mp) => mp.isCurrent);
  
  // Create current month's price
  const dynamicPrice = await createConnectedPrice(...);
  newStripePriceId = dynamicPrice.id;

  // Create PriceQueueItem records
  const priceQueueItems = data.monthlyPrices.map((mp) => ({
    planId: existingPlan.id,
    price: mp.price,
    effectiveAt: new Date(`${mp.month}-01`),
    applied: mp.isCurrent,
    stripePriceId: mp.isCurrent ? dynamicPrice.id : null,
  }));

  await prisma.priceQueueItem.createMany({
    data: priceQueueItems,
  });

  // Subscriptions update via webhook at next billing
}
```

**Result:**
- ✅ Current month price created
- ✅ Price queue populated for future months
- ✅ Webhook updates subscriptions at their next billing cycle

## User Experience

### Billing Settings (Locked)

When a membership has active subscriptions, the billing configuration screen shows:

```
┌─────────────────────────────────────────────┐
│ Billing Configuration                       │
├─────────────────────────────────────────────┤
│                                             │
│ ⚠️ Billing Settings Locked                 │
│    You have 12 active subscriptions.        │
│    Billing settings cannot be changed while │
│    subscriptions are active. Cancel or wait │
│    for subscriptions to expire before       │
│    modifying billing settings.              │
│                                             │
│ Billing Frequency: [Monthly ▼] 🔒          │
│                                             │
│ ○ Rolling Membership 🔒                     │
│ ○ Cohort (Immediate Access) 🔒              │
│ ○ Cohort (Deferred Start) 🔒                │
│                                             │
└─────────────────────────────────────────────┘
```

### Pricing Type Changes (Handled)

**Dynamic → Fixed:**
- Business changes pricing type to FIXED and sets basePrice
- API immediately updates all subscriptions
- Changes take effect at next billing (no proration)
- Logs show: "Updated 12 subscriptions to fixed price"

**Fixed → Dynamic:**
- Business changes pricing type to DYNAMIC and sets monthly prices
- API creates price queue items
- Subscriptions transition via webhook at next billing
- Logs show: "Changed to DYNAMIC pricing. Webhook will update subscriptions at next billing."

## Testing

### Test 1: Billing Changes with Active Subscriptions

```bash
# Setup
1. Create membership with rolling billing
2. Add plan and create 3 subscriptions
3. Try to change to cohort billing

# Expected Result
- API returns 400 error
- Error message: "Cannot change billing settings while active subscriptions exist"
- Details: "Found 3 active subscription(s)..."
- UI shows locked warning banner
- Billing fields are disabled
```

### Test 2: Billing Changes without Subscriptions

```bash
# Setup
1. Create membership with rolling billing
2. Add plan but no subscriptions
3. Change to cohort billing

# Expected Result
- ✅ Change succeeds
- No error
- New signups use cohort billing
```

### Test 3: Dynamic → Fixed Pricing

```bash
# Setup
1. Create dynamic plan with 3 active subscriptions
2. Change pricing type to FIXED ($99.99)

# Expected Process
1. API creates new fixed Stripe Price
2. API updates all 3 subscriptions in Stripe
3. API archives future dynamic prices
4. Changes apply at next billing

# Verification
- Check Stripe: All 3 subscriptions have new fixed price ID
- Check database: plan.pricingType = "FIXED"
- Check database: plan.stripePriceId = new fixed price
- Check database: Future priceQueueItems have applied = true
- Next billing: Customers charged fixed price
```

### Test 4: Fixed → Dynamic Pricing

```bash
# Setup
1. Create fixed plan with 3 active subscriptions
2. Change pricing type to DYNAMIC (set monthly prices)

# Expected Process
1. API creates current month's Stripe Price
2. API creates PriceQueueItem records
3. Subscriptions NOT updated yet
4. Wait for next billing cycle

# Verification
- Check Stripe: Subscriptions still have old fixed price (correct)
- Check database: plan.pricingType = "DYNAMIC"
- Check database: 6 PriceQueueItem records created
- Wait for Customer A billing date
- Webhook fires: invoice.created
- Webhook updates subscription to dynamic price
- Customer charged dynamic price ✅
```

## API Error Responses

### Billing Change Blocked

```json
{
  "error": "Cannot change billing settings while active subscriptions exist",
  "details": "Found 12 active subscription(s). These subscriptions must be cancelled or expired before changing billing settings.",
  "code": "ACTIVE_SUBSCRIPTIONS_EXIST",
  "activeSubscriptionCount": 12
}
```

Status: `400 Bad Request`

### Missing basePrice (Dynamic → Fixed)

```json
{
  "error": "Must provide basePrice when changing to FIXED pricing"
}
```

Status: `400 Bad Request`

### Missing monthlyPrices (Fixed → Dynamic)

```json
{
  "error": "Must provide monthlyPrices when changing to DYNAMIC pricing"
}
```

Status: `400 Bad Request`

### Missing current month price (Fixed → Dynamic)

```json
{
  "error": "Must set current month's price when changing to DYNAMIC pricing"
}
```

Status: `400 Bad Request`

## Files Changed

### Created
- ✅ `apps/web/src/app/api/memberships/[id]/subscription-count/route.ts` - Subscription count API
- ✅ `docs/plan-change-restrictions.md` - Detailed documentation
- ✅ `PLAN_CHANGE_RESTRICTIONS_COMPLETE.md` - This summary

### Modified
- ✅ `apps/web/src/app/api/memberships/[id]/route.ts` - Added billing change validation
- ✅ `apps/web/src/components/memberships/MembershipForm.tsx` - Added UI restrictions
- ✅ `apps/web/src/app/api/plans/[planId]/route.ts` - Added pricing type change handling

## Summary of Restrictions

| Change | Allowed? | Behavior |
|--------|----------|----------|
| **Billing Model** (when subs exist) | ❌ No | API returns 400, UI locked |
| **Billing Model** (when no subs) | ✅ Yes | Normal update |
| **Pricing Type: Dynamic → Fixed** | ✅ Yes | Updates all subscriptions immediately |
| **Pricing Type: Fixed → Dynamic** | ✅ Yes | Webhook updates at next billing |
| **Price within type** | ✅ Yes | Webhook handles at next billing |
| **Name, description, status** | ✅ Yes | Metadata only, no impact |

## Benefits

### Prevents Breaking Changes
- ❌ No more confused customers with unexpected billing dates
- ❌ No more manual Stripe subscription fixes
- ❌ No more prorating nightmares

### Clear User Experience
- ✅ Visual warnings when restrictions apply
- ✅ Clear error messages explaining why
- ✅ Tells business exactly what to do (cancel subscriptions first)

### Safe Pricing Transitions
- ✅ Dynamic → Fixed: Immediate, controlled update
- ✅ Fixed → Dynamic: Gradual, webhook-driven transition
- ✅ No customer disruption
- ✅ Proper audit trail

## Next Steps

1. **Deploy to staging** and test all scenarios
2. **Test with real Stripe subscriptions** (not test mode)
3. **Monitor logs** for pricing type changes
4. **Consider adding:**
   - Email notification when pricing type changes
   - Dashboard alert showing pending transitions
   - CSV export of affected subscriptions before change

## Notes

- **No customer notification:** Pricing type changes happen silently at next billing
- **No prorations:** All price changes use `proration_behavior: "none"`
- **Immediate for Dynamic → Fixed:** Can't wait for next billing (subscriptions stuck on old dynamic prices)
- **Deferred for Fixed → Dynamic:** Safe to wait (webhook handles it correctly)

---

**Status:** ✅ Implementation Complete
**Ready for:** Testing and Deployment
**Branch:** `feature/refine-dynamic-pricing`

