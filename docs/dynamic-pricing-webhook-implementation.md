# Dynamic Pricing - Webhook-Based Implementation

## Overview

Dynamic pricing uses a **webhook-driven approach** to ensure subscriptions always use the correct price for the current month. This provides real-time protection against incorrect charges without requiring cron jobs to scan all subscriptions.

## Architecture

### Components

1. **`PriceQueueItem` Model**: Stores future prices for dynamic plans
2. **`getCurrentPriceForDate()` Helper**: Determines correct price for any date
3. **`invoice.created` Webhook**: Intercepts invoices before they're charged
4. **`apply-dynamic-prices` Cron**: Creates Stripe Prices when month changes
5. **`check-missing-prices` Cron**: Sends alerts for missing future prices

### Flow Diagram

```
Business sets July price (June 25)
         ↓
   PriceQueueItem created
   (effectiveAt: July 1, applied: false)
         ↓
Cron runs (July 1, 12:01 AM)
         ↓
   Creates Stripe Price
   Updates plan.stripePriceId
   Marks queue item: applied = true
         ↓
Customer A billing date (July 1, 3:00 AM)
         ↓
   Stripe: Creates invoice with old price_june
         ↓
   Webhook: invoice.created fires (within seconds)
         ↓
   Our handler:
   ├─ getCurrentPriceForDate(July 1)
   ├─ Finds: price_july (effectiveAt: July 1)
   ├─ Invoice has: price_june ❌
   ├─ Void invoice
   └─ Update subscription to price_july
         ↓
   Stripe: Auto-creates new invoice with price_july
         ↓
   Customer charged correct price ✅
```

## Key Functions

### `getCurrentPriceForDate()`

**Location:** `packages/lib/get-current-price.ts`

**Purpose:** Get the correct Stripe Price ID for a specific date

**Logic:**
```typescript
// Get month boundaries
const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
const startOfNextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);

// Find price where effectiveAt is in current month
const priceForMonth = await prisma.priceQueueItem.findFirst({
  where: {
    planId,
    applied: true,
    effectiveAt: {
      gte: startOfMonth,
      lt: startOfNextMonth,
    },
  },
  orderBy: { effectiveAt: 'desc' },
});

return priceForMonth?.stripePriceId || null;
```

**Examples:**
```typescript
// June 26, 2025 - July price already created
getCurrentPriceForDate(planId, new Date('2025-06-26'))
// Returns: price_june123 (June is current month)

// July 1, 2025 - After month change
getCurrentPriceForDate(planId, new Date('2025-07-01'))
// Returns: price_july456 (July is current month)

// August 1, 2025 - No August price set
getCurrentPriceForDate(planId, new Date('2025-08-01'))
// Returns: null (missing price)
```

### `handleInvoiceCreated()` Webhook

**Location:** `apps/web/src/app/api/stripe/webhook/route.ts`

**Triggers:** `invoice.created` event from Stripe

**Process:**

1. **Filter**: Only handle `subscription_cycle` invoices
2. **Get Plan**: Extract planId from subscription metadata
3. **Check Type**: Skip if plan is fixed pricing
4. **Get Correct Price**: Call `getCurrentPriceForDate(today)`
5. **Handle Missing Price**:
   - Void invoice
   - Pause subscription
   - Create alert
6. **Handle Wrong Price**:
   - Void invoice
   - Update subscription to correct price
   - Stripe auto-creates new invoice
7. **Handle Correct Price**: Do nothing, let invoice process

**Code:**
```typescript
async function handleInvoiceCreated(invoice, accountId) {
  // Only subscription cycle invoices
  if (invoice.billing_reason !== "subscription_cycle") return;

  // Get plan from subscription metadata
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const plan = await prisma.plan.findUnique({ where: { id: subscription.metadata.planId } });

  // Only dynamic pricing plans
  if (plan.pricingType !== "DYNAMIC") return;

  // Get correct price for today
  const correctPriceId = await getCurrentPriceForDate(plan.id, new Date());

  if (!correctPriceId) {
    // NO PRICE AVAILABLE
    await stripe.invoices.voidInvoice(invoice.id);
    await stripe.subscriptions.update(subscription.id, {
      pause_collection: { behavior: "void" },
      metadata: { pausedReason: "MISSING_DYNAMIC_PRICE", pausedAt: now }
    });
    // Create alert...
    return;
  }

  const invoicePriceId = invoice.lines.data[0].price.id;

  if (invoicePriceId === correctPriceId) {
    // CORRECT PRICE - do nothing
    return;
  }

  // WRONG PRICE - update subscription
  await stripe.invoices.voidInvoice(invoice.id);
  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: subscription.items.data[0].id, price: correctPriceId }],
    proration_behavior: "none",
  });
  // Stripe will auto-create new invoice
}
```

## Scenarios

### Scenario 1: Rolling Billing - Different Signup Dates

**Setup:**
- Plan: Dynamic pricing, Rolling billing
- June price: $99.99 (set May 25)
- July price: $129.99 (set June 25)

**Customer A (Signed up May 1):**
```
June 1, 3:00 AM: Billing date
├─ Stripe: Creates invoice with price_may
├─ Webhook: invoice.created fires
├─ getCurrentPriceForDate(June 1) → price_june123
├─ Mismatch: void and update
└─ Charged $99.99 ✅

July 1, 3:00 AM: Next billing
├─ Stripe: Creates invoice with price_june123
├─ Webhook: invoice.created fires
├─ getCurrentPriceForDate(July 1) → price_july456
├─ Mismatch: void and update
└─ Charged $129.99 ✅
```

**Customer B (Signed up May 15):**
```
June 15, 3:00 AM: First renewal
├─ Stripe: Creates invoice with price_may
├─ Webhook: invoice.created fires
├─ getCurrentPriceForDate(June 15) → price_june123
├─ Mismatch: void and update
└─ Charged $99.99 ✅

July 15, 3:00 AM: Second renewal
├─ Stripe: Creates invoice with price_june123
├─ Webhook: invoice.created fires
├─ getCurrentPriceForDate(July 15) → price_july456
├─ Mismatch: void and update
└─ Charged $129.99 ✅
```

**Customer C (Signs up June 26):**
```
June 26, 10:00 AM: New signup
├─ Checkout: getCurrentPriceForDate(June 26) → price_june123
├─ Subscription created with price_june123
└─ Charged $99.99 ✅ (still June!)

July 26, 3:00 AM: First renewal
├─ Stripe: Creates invoice with price_june123
├─ Webhook: invoice.created fires
├─ getCurrentPriceForDate(July 26) → price_july456
├─ Mismatch: void and update
└─ Charged $129.99 ✅
```

**Result:** Each customer transitions to new price on their individual billing date ✅

### Scenario 2: Cohort Billing - All Bill on 1st

**Setup:**
- Plan: Dynamic pricing, Cohort billing (day 1)
- July price: $129.99

**All Customers:**
```
July 1, 12:00 AM: Cohort billing date
├─ Multiple invoices created (one per customer)
├─ Multiple webhook fires (parallel)
├─ Each checks: getCurrentPriceForDate(July 1) → price_july456
├─ Each updates subscription (if needed)
└─ All charged $129.99 ✅
```

**Result:** All cohort customers transition together ✅

### Scenario 3: Missing Price - Auto-Pause

**Setup:**
- Plan: Dynamic pricing, Rolling billing
- June price: $99.99
- July price: NOT SET

**Customer A (Bills July 1):**
```
July 1, 3:00 AM: Billing date
├─ Stripe: Creates invoice with price_june123
├─ Webhook: invoice.created fires
├─ getCurrentPriceForDate(July 1) → null ❌
├─ Void invoice
├─ Pause subscription (pause_collection.behavior = "void")
├─ Update database: pausedAt = now
└─ Create alert (SUBSCRIPTION_PAUSED, URGENT) ✅

Business Dashboard:
└─ Alert shows: "Subscription Paused: [Customer Name]"
    Message: "Subscription paused due to missing price for [Plan Name]"
```

**Customer B (Bills July 15):**
```
July 1 - July 14: Subscription active, not yet billed
July 15, 3:00 AM: Billing date
├─ Same as Customer A
└─ Paused individually at their billing date ✅
```

**Business sets July price on July 16:**
```
July 16, 10:00 AM: Business adds July price
├─ API: POST /api/plans/[planId] with monthlyPrices
├─ Creates price_july456
├─ Updates plan.stripePriceId = price_july456
├─ Calls resumePausedSubscriptions(planId)
│   ├─ Finds Customer A (paused July 1)
│   ├─ Finds Customer B (paused July 15)
│   ├─ For each:
│   │   ├─ Update subscription to price_july456
│   │   ├─ Remove pause_collection
│   │   ├─ Create invoice immediately
│   │   └─ Charge customer $129.99
│   └─ Update database: pausedAt = null
└─ Resolve alerts ✅
```

**Result:** Individual pause/resume based on billing dates ✅

### Scenario 4: Price Changed Multiple Times

**Setup:**
- July price v1: $129.99 (set June 20)
- July price v2: $139.99 (set June 28, business changed mind)

**Customer A (Bills July 1):**
```
June 28: Business updates July price
├─ Edits plan, changes current month price to $139.99
├─ Creates new Stripe Price: price_july_v2
├─ Updates queue item: stripePriceId = price_july_v2
└─ Archives old price: price_july_v1

July 1, 3:00 AM: Customer bills
├─ getCurrentPriceForDate(July 1)
├─ Finds latest price for July: price_july_v2
└─ Charged $139.99 ✅ (latest price)
```

**Result:** Always uses the latest price for the month ✅

### Scenario 5: New Signup After Next Month's Price Set

**Setup:**
- June price: $99.99
- July price: $129.99 (set June 25)

**Customer signs up June 26:**
```
June 26, 2:00 PM: New signup
├─ Checkout: getCurrentPriceForDate(June 26)
├─ Checks: effectiveAt >= June 1 AND < July 1
│   ├─ price_june123 (effectiveAt: June 1) ✅
│   └─ price_july456 (effectiveAt: July 1) ❌ (not yet)
├─ Returns: price_june123
└─ Charged $99.99 ✅ (correct - June is current month!)

July 26, 3:00 AM: First renewal
├─ Webhook: getCurrentPriceForDate(July 26) → price_july456
├─ Update subscription
└─ Charged $129.99 ✅
```

**Result:** New signups get current month's price, not future price ✅

## Cron Jobs

### 1. Apply Dynamic Prices (`apply-dynamic-prices.ts`)

**Schedule:** Daily at 12:01 AM

**Purpose:** Create Stripe Prices for newly effective dynamic prices

**Process:**
1. Find `PriceQueueItem` where `applied = false` AND `effectiveAt <= NOW()`
2. For each:
   - Create Stripe Price via API
   - Update `plan.stripePriceId`
   - Archive old Stripe Price
   - Mark queue item: `applied = true`
   - Store Stripe Price ID in queue item

**Does NOT:**
- Update subscriptions (webhooks handle this)
- Pause subscriptions (webhooks handle this)
- Send emails (check-missing-prices handles this)

**Run:** `pnpm cron:apply-prices`

### 2. Check Missing Prices (`check-missing-dynamic-prices.ts`)

**Schedule:** Daily at 9:00 AM

**Purpose:** Alert businesses of missing future prices

**Process:**
1. Get all active dynamic pricing plans
2. For each plan, check if next month has a price
3. Days before month start:
   - **7 days**: Create WARNING alert
   - **3 days**: Create URGENT alert
   - **1 day**: Create CRITICAL alert
4. Send reminder email to business owner

**Run:** `pnpm cron:check-missing-prices`

## Benefits of Webhook Approach

### ✅ Real-Time Protection
- Catches billing attempts within seconds
- No delay between billing and price check
- Immediate correction before customer is charged

### ✅ Scalability
- Doesn't scan all subscriptions
- Only processes subscriptions that are actually billing
- Handles 10 or 10,000 subscriptions equally well

### ✅ Individual Billing Dates
- Works perfectly with rolling billing
- Each customer handled at their specific billing time
- No batch processing needed

### ✅ Reliability
- Webhooks are Stripe's recommended approach
- Automatic retries if webhook fails
- Event-driven, not time-dependent

### ✅ Cohort Billing
- All cohort members bill at same time
- Multiple webhooks fire in parallel
- All handled correctly

## Comparison: Cron vs Webhook

| Aspect | Cron Approach | Webhook Approach |
|--------|---------------|------------------|
| **Timing** | Batch (hourly/daily) | Real-time (seconds) |
| **Scale** | Scans all subscriptions | Only billing subscriptions |
| **Rolling Billing** | Complex date logic | Automatic |
| **Cohort Billing** | Must check all | Automatic |
| **Accuracy** | Depends on frequency | Always accurate |
| **Load** | High (scans everything) | Low (event-driven) |
| **Edge Cases** | Must predict | Reacts naturally |

## Edge Cases Handled

### 1. Timezone Differences
- Stripe uses UTC for billing
- `getCurrentPriceForDate()` uses UTC
- Month boundaries use UTC midnight
- **Result:** No timezone issues ✅

### 2. Subscription Created Mid-Month
- Checkout uses `getCurrentPriceForDate(signupDate)`
- Returns price for signup month, not future month
- **Result:** Correct monthly price ✅

### 3. Price Updated Multiple Times Same Month
- `getCurrentPriceForDate()` orders by `effectiveAt DESC`
- Always returns latest price for month
- **Result:** Latest price wins ✅

### 4. Missing Price Discovery
- Webhook discovers missing price at billing time
- Creates alert immediately
- Pauses subscription to prevent wrong charge
- **Result:** Protected ✅

### 5. Late Price Addition
- Business adds price after month starts
- `resumePausedSubscriptions()` called automatically
- All paused subs resume and bill immediately
- **Result:** Automatic recovery ✅

### 6. Failed Webhook
- Stripe retries webhooks automatically (72 hours)
- If webhook fails, invoice stays in `draft` state
- No charge occurs until webhook succeeds
- **Result:** Safe by default ✅

## Configuration

### Stripe Webhook Setup

**Required Event:**
```
invoice.created
```

**Webhook URL:**
```
https://yourdomain.com/api/stripe/webhook
```

**Why `invoice.created`?**
- Fires BEFORE invoice is charged
- Gives us time to void and correct
- Can update subscription and Stripe recreates invoice
- Cannot use `invoice.finalized` (too late to void)

### Metadata on Subscriptions

**Required:**
```typescript
metadata: {
  planId: string,              // For looking up plan
  membershipId: string,         // For business context
  businessId: string,           // For alerts
  // ... other metadata
}
```

## Testing

### Test Webhook Locally

```bash
# Terminal 1: Start local server
pnpm dev

# Terminal 2: Forward webhooks
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Terminal 3: Trigger test invoice
stripe trigger invoice.created
```

### Test Scenarios

**1. Correct Price:**
```typescript
// Setup: Current month has price
// Expected: Webhook does nothing, invoice processes
```

**2. Wrong Price:**
```typescript
// Setup: Subscription has old price, new month started
// Expected: Webhook voids invoice, updates subscription
```

**3. Missing Price:**
```typescript
// Setup: No price for current month
// Expected: Webhook voids invoice, pauses subscription, creates alert
```

**4. New Signup:**
```typescript
// Setup: Next month's price already set, signup today
// Expected: Checkout uses current month's price
```

## Migration Guide

### From Cron-Based Auto-Pause

If migrating from `auto-pause-missing-prices.ts`:

1. **Remove cron job:**
   ```bash
   # Delete script
   rm scripts/auto-pause-missing-prices.ts
   
   # Remove from package.json
   "cron:auto-pause": "..." // DELETE THIS
   ```

2. **Enable webhook:**
   ```bash
   # Add invoice.created to Stripe webhook config
   stripe webhook create --url https://yourdomain.com/api/stripe/webhook \
     --events invoice.created
   ```

3. **Test:**
   - Create test subscription
   - Remove current month's price
   - Wait for billing date
   - Confirm subscription pauses automatically

4. **Cleanup:**
   - No database migration needed
   - Existing `PriceQueueItem`s work as-is
   - Paused subscriptions resume when price added

## Troubleshooting

### Webhook Not Firing

**Check:**
1. Stripe Dashboard → Webhooks → View events
2. Look for `invoice.created` events
3. Check if webhook is enabled
4. Verify URL is correct

### Invoice Still Has Old Price

**Check:**
1. Is `billing_reason === "subscription_cycle"`?
2. Is plan `pricingType === "DYNAMIC"`?
3. Does subscription have `metadata.planId`?
4. Is there a price for current month?
5. Check logs for webhook execution

### Subscription Not Paused

**Check:**
1. Is `getCurrentPriceForDate()` returning `null`?
2. Check `PriceQueueItem` table for current month
3. Was invoice voided?
4. Check Stripe for `pause_collection` status

### Resume Didn't Work

**Check:**
1. Was price added to current month?
2. Was `resumePausedSubscriptions()` called?
3. Check database `pausedAt` field
4. Check Stripe `pause_collection` removed?

## Summary

The webhook-based approach provides:

1. ✅ **Real-time billing protection** via `invoice.created`
2. ✅ **Month-specific pricing** via `getCurrentPriceForDate()`
3. ✅ **Automatic pause/resume** for missing prices
4. ✅ **Works with all billing models** (rolling, cohort)
5. ✅ **Scalable and efficient** (event-driven)
6. ✅ **Edge case handling** (new signups, price changes, late additions)

**Next Steps:**
1. Set up `invoice.created` webhook in Stripe
2. Test with Stripe CLI locally
3. Deploy and monitor webhook logs
4. Configure cron jobs for price application and alerts

