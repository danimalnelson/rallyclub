# Dynamic Pricing Implementation

**Date:** 2025-11-16  
**Branch:** `feature/refine-dynamic-pricing`

---

## Overview

This document describes the implementation of dynamic pricing for subscription plans, where prices can vary month-to-month. The solution allows business owners to pre-set prices for upcoming months in a simple table format.

---

## Key Design Decisions

### 1. **Monthly Cadence Only**
- All subscriptions follow a monthly billing cycle
- Dynamic pricing = different price each month
- Business owners set prices for current month + next N months (default: 6 months)

### 2. **Pre-set Pricing Table**
- Instead of a separate price management page, prices are set directly in the `PlanForm`
- Shows a table with current month + next 6 months
- Current month is **required**, future months are optional
- If a future month is blank, the last set price continues

### 3. **Current Price Always Available**
- Dynamic plans always have a `stripePriceId` pointing to the current active price
- Checkout works the same for both FIXED and DYNAMIC plans
- No manual intervention needed at checkout time

---

## Database Schema

### Updated Models

**Plan** (no changes needed)
```prisma
model Plan {
  pricingType  PricingType  // FIXED | DYNAMIC
  stripePriceId String?     // Current active Stripe Price ID (set for both types)
  basePrice    Int?         // Only used for FIXED pricing
  priceQueue   PriceQueueItem[]
}
```

**PriceQueueItem** (existing)
```prisma
model PriceQueueItem {
  id           String   @id
  planId       String
  effectiveAt  DateTime // When this price takes effect (1st of month)
  price        Int      // In cents
  applied      Boolean  // true = already active, false = scheduled
  stripePriceId String? // Stripe Price ID (set when applied)
  
  // Notification tracking
  notifiedAt7Days DateTime?
  notifiedAt1Day  DateTime?
}
```

---

## Implementation Components

### 1. UI Components

#### PlanForm.tsx
**Location:** `apps/web/src/components/plans/PlanForm.tsx`

**Features:**
- Dynamic pricing type selector
- Monthly price table (6 months visible)
- Current month highlighted and required
- Real-time validation
- Auto-generates month labels

**UI Elements:**
```
┌──────────────────────────────────────┐
│ Pricing Type: [Dynamic ▼]            │
│                                       │
│ Month          Price      Status     │
│ ─────────────────────────────────── │
│ Nov 2025 ⭐    $99.99    Active      │
│ Dec 2025       $129.99   Scheduled   │
│ Jan 2026       $149.99   Scheduled   │
│ Feb 2026       (empty)   Uses $149.99│
│ ...                                   │
└──────────────────────────────────────┘
```

### 2. API Routes

#### POST /api/plans/create
**Purpose:** Create new plan with dynamic pricing

**Logic:**
1. Validate `monthlyPrices` array has current month
2. Create Stripe Product
3. Create Stripe Price for **current month only**
4. Set `plan.stripePriceId` to current price
5. Create `PriceQueueItem` records for all months:
   - Current month: `applied: true`, has `stripePriceId`
   - Future months: `applied: false`, `stripePriceId: null`

#### PUT /api/plans/[planId]
**Purpose:** Update plan and sync prices

**Logic:**
1. If current month price changed → create new Stripe Price
2. Delete all unapplied (future) price queue items
3. Create new price queue items from updated `monthlyPrices`
4. Validate: Cannot activate without current price

#### GET /api/plans/[planId]
**Purpose:** Fetch plan for editing

**Additions:**
- Include `priceQueue` relation
- Transform queue items into `monthlyPrices` format for form
- Convert cents to dollars for display

#### POST /api/checkout/[slug]/[planId]/confirm
**Purpose:** Create subscription

**Changes:**
- Improved error message for missing price
- Uses `plan.stripePriceId` (works for both FIXED and DYNAMIC)

### 3. Cron Job

#### scripts/apply-dynamic-prices.ts
**Purpose:** Automatically apply scheduled prices

**Schedule:** Run daily (or hourly) via cron

**Logic:**
```typescript
1. Find PriceQueueItem where:
   - applied = false
   - effectiveAt <= NOW()

2. For each item:
   a. Create Stripe Price
   b. Archive old Stripe Price
   c. Update plan.stripePriceId
   d. Mark queue item as applied
   e. Set queue item.stripePriceId

3. [TODO] Send notification emails to subscribers
```

**Run manually:**
```bash
pnpm cron:apply-prices
```

---

## User Workflows

### Creating a Dynamic Pricing Plan

1. **Business owner visits** `/app/[businessId]/plans/new`
2. **Selects** "Dynamic (price varies)" from pricing type
3. **Sees table** with current month + next 6 months
4. **Fills in prices:**
   - Nov 2025: $99.99 (required)
   - Dec 2025: $129.99 (optional)
   - Jan 2026: $149.99 (optional)
   - (rest blank → uses $149.99)
5. **Saves plan**
   - ✅ Current price is immediately active
   - ✅ Future prices are scheduled
   - ✅ Plan can be activated

### Editing Dynamic Pricing

1. **Business owner visits** `/app/[businessId]/plans/[planId]/edit`
2. **Sees existing price schedule** pre-filled
3. **Updates prices:**
   - Change current month → new Stripe Price created immediately
   - Change future months → queue updated
   - Delete future months → remove from queue
4. **Saves changes**
   - ✅ Current price updates propagate to Stripe
   - ✅ Future prices are synced

### Automatic Price Application

1. **Cron job runs** (e.g., daily at midnight)
2. **Finds** price queue items where `effectiveAt` has passed
3. **For each:**
   - Creates new Stripe Price
   - Updates `plan.stripePriceId`
   - Archives old Stripe Price
   - Marks queue item as applied
4. **Result:** New subscribers get the new price automatically

### Customer Checkout

1. **Customer visits** `/[slug]/[planId]`
2. **Sees current price** (from `plan.stripePriceId`)
3. **Completes checkout**
4. **Subscription created** with current active price

---

## Validation Rules

### Plan Creation
- ❌ Cannot create DYNAMIC plan without current month price
- ❌ Cannot activate DYNAMIC plan without current month price
- ✅ Future months are optional

### Plan Updates
- ❌ Cannot activate DYNAMIC plan without `stripePriceId`
- ✅ Can update future prices anytime
- ✅ Updating current price creates new Stripe Price immediately

### Checkout
- ❌ Cannot checkout if `plan.stripePriceId` is null
- ✅ Better error message for dynamic plans

---

## Edge Cases Handled

### 1. **No Future Prices Set**
- ✅ Last set price continues (handled at checkout - uses current `stripePriceId`)

### 2. **Editing Before Price Applied**
- ✅ Unapplied prices are deleted and recreated on save

### 3. **Changing Current Price**
- ✅ New Stripe Price created immediately
- ✅ Old Stripe Price archived

### 4. **Plan Has Active Subscribers**
- ⚠️ Existing subscribers keep their old subscription price (Stripe behavior)
- ✅ New subscribers get the new price

### 5. **Cron Job Failure**
- ⚠️ Price won't apply until next run
- ✅ Job continues with other prices if one fails
- ✅ Manual run available: `pnpm cron:apply-prices`

---

## Future Enhancements

### Member Notifications
- [ ] Email subscribers 7 days before price change
- [ ] Email subscribers 1 day before price change
- [ ] Track notifications in `PriceQueueItem` fields

### Price History
- [ ] Show price history chart in plan details
- [ ] Export price history for analytics

### Bulk Price Updates
- [ ] Update multiple plans' prices at once
- [ ] Copy price schedule from one plan to another

### Advanced Scheduling
- [ ] Seasonal pricing (e.g., $99 in summer, $129 in winter)
- [ ] Promotional pricing windows

---

## Testing Checklist

### UI
- [ ] Create FIXED plan → shows single price input
- [ ] Create DYNAMIC plan → shows monthly table
- [ ] Switch between FIXED/DYNAMIC → table appears/disappears
- [ ] Current month input is required and highlighted
- [ ] Form validation shows errors for missing current price

### API
- [ ] POST /api/plans/create with FIXED pricing → creates single Stripe Price
- [ ] POST /api/plans/create with DYNAMIC pricing → creates current Stripe Price + queue items
- [ ] PUT /api/plans/[planId] with price change → creates new Stripe Price
- [ ] PUT /api/plans/[planId] with future prices → syncs queue
- [ ] Cannot activate DYNAMIC plan without current price

### Cron Job
- [ ] Run `pnpm cron:apply-prices` manually → applies pending prices
- [ ] Create future price → cron applies it after effectiveAt
- [ ] Multiple pending prices → all applied correctly

### Checkout
- [ ] Checkout with FIXED plan → works
- [ ] Checkout with DYNAMIC plan (has price) → works
- [ ] Checkout with DYNAMIC plan (no price) → shows error

---

## Deployment

### Production Setup

1. **Database Migration:**
   ```bash
   pnpm db:push
   ```

2. **Set up cron job** (e.g., on Vercel Cron, GitHub Actions, or external service):
   ```yaml
   # Example: Run daily at midnight UTC
   - cron: "0 0 * * *"
     run: pnpm cron:apply-prices
   ```

3. **Environment Variables:**
   - No new env vars required
   - Uses existing DATABASE_URL and Stripe credentials

---

## Summary

This implementation provides a **simple, intuitive way** for business owners to manage dynamic pricing:

✅ **Easy to use:** Price table right in the plan form  
✅ **Automated:** Cron job applies prices on schedule  
✅ **Safe:** Validation prevents activation without prices  
✅ **Flexible:** Optional future prices with fallback to last price  
✅ **Stripe-native:** Minimal custom logic, leverages Stripe's pricing model  

**Next Steps:**
1. Deploy to production
2. Set up cron job
3. Test with real business
4. Add member notification emails

