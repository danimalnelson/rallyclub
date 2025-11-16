# Dynamic Pricing: Missing Price Handling Strategy

**Date:** 2025-11-16  
**Status:** Implementation In Progress

---

## Overview

This document outlines the strategy for handling scenarios where a dynamic pricing plan does not have a price set for an upcoming billing period.

**Key Principle:** No fallback to previous price. Explicit pricing required for each month.

---

## Alert & Notification System

### 1. Reminder Schedule

Business owners receive email reminders when next month's price is not set:

- **7 days before** (WARNING) → "Please set December pricing"
- **3 days before** (URGENT) → "December pricing needed ASAP"
- **1 day before** (CRITICAL) → "URGENT: Set December pricing by tomorrow"

### 2. Alert Dashboard

**Location:** `/app/[businessId]/alerts`

**Features:**
- Summary cards for each alert type
- Missing dynamic prices (top priority)
- Failed payments
- Paused subscriptions
- Cancelled subscriptions
- Past due subscriptions

**Actions:**
- "Set Price" → Navigate to plan edit page
- "Resolve" → Mark alert as resolved

### 3. Cron Jobs

**check-missing-dynamic-prices.ts**
- Runs: Daily
- Purpose: Create alerts and send emails 7/3/1 days before
- Command: `pnpm cron:check-missing-prices`

**apply-dynamic-prices.ts**
- Runs: Daily (or hourly)
- Purpose: Apply scheduled prices when effectiveAt arrives
- Command: `pnpm cron:apply-prices`

---

## Scenarios & Handling

### Scenario 1: New Signup (No Current Price)

**Situation:**
- Customer tries to sign up for dynamic plan
- No price set for current month
- `plan.stripePriceId` is null

**Handling:**
```typescript
// checkout/confirm/route.ts
if (!plan.stripePriceId && plan.pricingType === "DYNAMIC") {
  return {
    error: "This plan is temporarily unavailable. The business owner needs to set pricing for the current month.",
    code: "DYNAMIC_PRICE_NOT_SET",
    status: 503 // Service Unavailable
  }
}
```

**Result:**
- ❌ Checkout blocked
- Customer sees friendly error message
- Business owner has alert in dashboard

---

### Scenario 2: Billing Date Arrives (Rolling/Anniversary) - NO PRICE

**Situation:**
- Customer signed up Nov 15 (bills on 15th of each month)
- Dec 15 arrives
- No December price set in queue

**Options to Consider:**

#### Option A: Auto-Pause (RECOMMENDED)
```
1. Stripe subscription.pause_collection is set
2. BusinessAlert created (SUBSCRIPTION_PAUSED)
3. Email sent to customer: "Subscription paused - new pricing being set"
4. Email sent to business: "Customer paused due to missing price"
5. When price is added → subscription resumes → charge immediately
```

**Pros:**
- Clear communication to customer
- No free service given
- Business maintains control

**Cons:**
- Customer experience interrupted
- Requires resume logic

#### Option B: Skip Billing Cycle
```
1. Don't charge customer
2. Extend subscription by 1 month
3. Email customer: "This month free - pricing update in progress"
4. Next month bills normally
```

**Pros:**
- Customer gets free month (goodwill)
- No interruption to service

**Cons:**
- Revenue loss
- Could be abused
- Complex to track

#### Option C: Cancel Subscription
```
1. Cancel subscription (don't renew)
2. Email customer and business
3. Customer can re-signup when pricing available
```

**Pros:**
- Clean break
- No ongoing commitment

**Cons:**
- Loses customer
- Poor experience

**DECISION NEEDED:** Which option should we implement?

---

### Scenario 3: Billing Date Arrives (Cohort) - NO PRICE

**Situation:**
- All customers bill on 1st of month
- Dec 1 arrives
- No December price set

**Handling (if Option A chosen):**
```
1. ALL subscriptions for this plan auto-pause
2. Mass alert created for business
3. Email sent to all customers
4. When price added → all resume → all charged
```

**Considerations:**
- Affects all customers simultaneously
- Higher urgency than rolling
- More visible to business (all customers paused at once)

---

### Scenario 4: Price Added Late (After Billing Date)

**Situation:**
- Billing date was Dec 15
- Now Dec 18
- Business finally adds December price

**Handling (if Option A chosen):**

```typescript
// When price is added via PlanForm
1. Create Stripe Price (done)
2. Update plan.stripePriceId (done)
3. Mark queue item as applied (done)
4. NEW: Find all paused subscriptions for this plan
5. For each paused subscription:
   a. Resume subscription (remove pause_collection)
   b. Charge immediately (create invoice)
   c. Update PlanSubscription status
   d. Resolve SUBSCRIPTION_PAUSED alert
   e. Email customer: "Subscription resumed"
```

**API Route Needed:**
```typescript
// PUT /api/plans/[planId]
// After creating Stripe Price for dynamic plan:
if (currentPriceChanged && existingPlan.pricingType === "DYNAMIC") {
  await resumePausedSubscriptions(existingPlan.id, newStripePriceId);
}
```

**Helper Function:**
```typescript
async function resumePausedSubscriptions(planId: string, stripePriceId: string) {
  // Find paused subscriptions
  const pausedSubs = await prisma.planSubscription.findMany({
    where: {
      planId,
      status: "paused", // or check Stripe status
    },
  });
  
  for (const sub of pausedSubs) {
    // Resume in Stripe
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      pause_collection: null, // Resume
      items: [{
        id: subscription.items.data[0].id,
        price: stripePriceId, // Update to new price
      }],
    });
    
    // Create immediate invoice
    await stripe.invoices.create({
      customer: sub.stripeCustomerId,
      subscription: sub.stripeSubscriptionId,
    });
    
    await stripe.invoices.finalizeInvoice(invoice.id);
    
    // Update database
    await prisma.planSubscription.update({
      where: { id: sub.id },
      data: { status: "active" },
    });
  }
}
```

---

## Implementation Status

### ✅ Completed

1. Schema updates (BusinessAlert model, notifiedAt3Days)
2. Alert API routes (GET /api/alerts, POST /api/alerts/[id]/resolve)
3. Alerts dashboard page
4. check-missing-dynamic-prices cron job
5. Checkout prevention (no price = no signup)

### 🚧 Pending User Decision

**Critical Decision:** How to handle missing prices at billing time?
- Option A: Auto-pause (recommended)
- Option B: Skip billing cycle
- Option C: Cancel subscription

### 📋 TODO (After Decision)

1. Implement chosen option in Stripe webhook handler
2. Create resume logic for late price additions
3. Email notification service (currently commented out)
4. Update Transactions page (focus on revenue only)
5. Integration testing with Stripe test mode

---

## Database Schema

### BusinessAlert
```prisma
model BusinessAlert {
  id          String       @id
  businessId  String
  type        AlertType    // MISSING_DYNAMIC_PRICE, FAILED_PAYMENT, etc.
  severity    AlertSeverity // INFO, WARNING, URGENT, CRITICAL
  title       String
  message     String
  metadata    Json?
  resolved    Boolean
  resolvedAt  DateTime?
  createdAt   DateTime
  updatedAt   DateTime
}

enum AlertType {
  MISSING_DYNAMIC_PRICE
  FAILED_PAYMENT
  SUBSCRIPTION_PAUSED
  SUBSCRIPTION_CANCELLED
  SUBSCRIPTION_PAST_DUE
}
```

### PriceQueueItem (updated)
```prisma
model PriceQueueItem {
  // ... existing fields
  notifiedAt7Days  DateTime?  // NEW
  notifiedAt3Days  DateTime?  // NEW
  notifiedAt1Day   DateTime?  // Already existed
}
```

---

## Technical Considerations

### Rolling vs Cohort Billing

**Rolling (Anniversary):**
- Each customer has different billing date
- Missing price affects customers individually as their date arrives
- Gradual problem (spreads over the month)

**Cohort (1st of month):**
- All customers bill on same date
- Missing price affects all customers simultaneously
- Immediate problem (all at once on 1st)

### Stripe Integration

**Pausing:**
```typescript
await stripe.subscriptions.update(subscriptionId, {
  pause_collection: {
    behavior: 'void', // Don't create invoices
  },
});
```

**Resuming:**
```typescript
await stripe.subscriptions.update(subscriptionId, {
  pause_collection: null, // Remove pause
  items: [{
    id: subscription.items.data[0].id,
    price: newPriceId,
  }],
});
```

**Immediate Charge After Resume:**
```typescript
const invoice = await stripe.invoices.create({
  customer: customerId,
  subscription: subscriptionId,
});
await stripe.invoices.finalizeInvoice(invoice.id);
```

---

## User Communication

### Customer Emails

**When Paused:**
```
Subject: Your [Plan Name] subscription is temporarily paused

Hi [Customer],

Your subscription has been temporarily paused while [Business Name] 
updates pricing for the current period. You won't be charged during 
this time, and your service will resume as soon as pricing is set.

We'll notify you when your subscription resumes.

Questions? Contact [Business Email]
```

**When Resumed:**
```
Subject: Your [Plan Name] subscription has resumed

Hi [Customer],

Good news! Your subscription has resumed and you'll be charged 
$[Amount] today for [Month]. Your next billing date is [Date].

Thank you for your patience!
```

### Business Emails

**7 Days Before:**
```
Subject: ⚠️ Set December pricing for [Plan Name]

Hi [Business Owner],

You have 7 days to set pricing for December for your dynamic 
pricing plan: [Plan Name]

Current subscribers: X
Action needed: Set price before Dec 1

[Set Price Now →]
```

**1 Day Before:**
```
Subject: 🚨 URGENT: Set December pricing TODAY

Hi [Business Owner],

URGENT: December pricing for [Plan Name] must be set by tomorrow.

X subscribers will be affected if no price is set.

[Set Price Now →]
```

---

## Next Steps

1. **User Decision:** Choose handling strategy (A, B, or C)
2. **Implement:** Auto-pause/resume logic
3. **Test:** End-to-end with Stripe test mode
4. **Email Service:** Create templates and sending logic
5. **Monitor:** Deploy cron jobs and monitor alerts

---

## Questions for User

1. **Which option for missing prices?** A (auto-pause), B (skip), or C (cancel)?
2. **Customer communication tone?** Apologetic? Matter-of-fact?
3. **Should paused subscriptions still have access?** Or cut off immediately?
4. **Grace period?** Give 24 hours after billing date before pausing?
5. **Platform fee handling?** How to handle platform fees for skipped/paused billing?

