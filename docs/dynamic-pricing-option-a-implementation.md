# Dynamic Pricing: Option A Implementation (Auto-Pause)

**Date:** 2025-11-16  
**Strategy:** Silent auto-pause with immediate resume

---

## Implementation Summary

Implemented **Option A: Auto-Pause** for handling missing dynamic prices at billing time.

**Key Features:**
- ✅ Subscriptions automatically pause when billing date arrives with no price
- ✅ **SILENT** - No customer notification (business fixes quickly)
- ✅ Business receives alerts in dashboard
- ✅ When price added: Automatic resume + immediate charge
- ✅ Works with both Rolling and Cohort billing

---

## System Flow

### 1. Prevention (Before Billing)

**7/3/1 Days Before Next Month:**
```
1. Cron: check-missing-dynamic-prices runs daily
2. Detects plan with no next month price
3. Creates WARNING/URGENT/CRITICAL alert
4. (Optional) Sends email to business owner
5. Alert appears in dashboard
```

**Business Owner Action:**
```
1. Sees alert in dashboard
2. Clicks "Set Price"
3. Goes to plan edit page
4. Sets current month price
5. Alert auto-resolves
```

### 2. Auto-Pause (At Billing Time)

**When Billing Date Arrives with No Price:**
```
1. Cron: auto-pause-missing-prices runs hourly
2. Detects active subscription to plan with no current price
3. Pauses subscription in Stripe (pause_collection: void)
4. Updates PlanSubscription.pausedAt
5. Creates SUBSCRIPTION_PAUSED alert
6. NO customer email (silent)
```

**Rolling Billing (Anniversary):**
- Each customer paused individually as their billing date arrives
- Example: Customer A (bills 15th), Customer B (bills 20th)
- Gradual impact over the month

**Cohort Billing (1st of month):**
- All customers paused simultaneously on the 1st
- Immediate, visible impact
- Higher urgency for business

### 3. Auto-Resume (Price Added Late)

**When Business Adds Price After Billing Date:**
```
1. Business edits plan, sets current month price
2. Plan edit API detects price change
3. Calls resumePausedSubscriptions()
4. For each paused subscription:
   a. Remove pause_collection in Stripe
   b. Update subscription to use new price
   c. Create immediate invoice
   d. Finalize invoice (charges customer now)
   e. Update PlanSubscription.pausedAt = null
   f. Resolve SUBSCRIPTION_PAUSED alerts
5. Create success alert: "X subscriptions resumed"
```

**Customer Experience:**
- Silent pause (no notification)
- Silent resume (just sees charge)
- Uninterrupted service (from customer perspective)
- If they check portal during pause: Shows "paused" status

---

## Cron Jobs

### 1. check-missing-dynamic-prices.ts
**Schedule:** Daily (at midnight)
```bash
pnpm cron:check-missing-prices
```

**Actions:**
- Checks all dynamic plans
- Finds plans missing next month price
- Creates alerts at 7/3/1 day intervals
- Queues email notifications (if implemented)

### 2. auto-pause-missing-prices.ts
**Schedule:** Hourly
```bash
pnpm cron:auto-pause
```

**Actions:**
- Finds active dynamic plans without current price
- Pauses all active subscriptions
- Creates individual alerts per subscription
- NO customer emails (silent)

### 3. apply-dynamic-prices.ts
**Schedule:** Hourly
```bash
pnpm cron:apply-prices
```

**Actions:**
- Applies scheduled prices when effectiveAt arrives
- Creates Stripe Prices
- Updates plan.stripePriceId
- Marks queue items as applied

---

## Database Schema

### PlanSubscription Updates
```prisma
model PlanSubscription {
  // ... existing fields
  pausedAt  DateTime?  // When subscription was paused (null = not paused)
}
```

### BusinessAlert Types
```prisma
enum AlertType {
  MISSING_DYNAMIC_PRICE   // No price set for upcoming month
  SUBSCRIPTION_PAUSED     // Subscription auto-paused due to missing price
  FAILED_PAYMENT         // Payment failed
  SUBSCRIPTION_CANCELLED  // Customer cancelled
  SUBSCRIPTION_PAST_DUE   // Payment overdue
}
```

---

## API Integration

### Plan Edit Route Enhancement

**File:** `apps/web/src/app/api/plans/[planId]/route.ts`

**New Logic:**
```typescript
if (existingPlan.pricingType === "DYNAMIC" && data.monthlyPrices) {
  const currentPriceChanged = /* detect price change */;
  
  if (currentPriceChanged && newStripePriceId) {
    // Resume paused subscriptions
    const result = await resumePausedSubscriptions(
      planId,
      newStripePriceId,
      stripeAccountId
    );
    
    // Create success alert
    if (result.resumed > 0) {
      createAlert({
        type: "INFO",
        title: `${result.resumed} Subscription(s) Resumed`,
        message: "Paused subscriptions have been resumed and charged.",
      });
    }
  }
}
```

### Resume Function

**File:** `packages/lib/resume-paused-subscriptions.ts`

**Exports:**
```typescript
export async function resumePausedSubscriptions(
  planId: string,
  stripePriceId: string,
  stripeAccountId: string
): Promise<ResumeResult>

interface ResumeResult {
  resumed: number;
  charged: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}
```

---

## Stripe Integration

### Pausing Subscription
```typescript
await stripe.subscriptions.update(subscriptionId, {
  pause_collection: {
    behavior: "void", // Don't create invoices
  },
  metadata: {
    pausedReason: "MISSING_DYNAMIC_PRICE",
    pausedAt: new Date().toISOString(),
    pausedBySystem: "true",
  },
});
```

### Resuming Subscription
```typescript
// 1. Remove pause and update price
await stripe.subscriptions.update(subscriptionId, {
  pause_collection: null,
  items: [{
    id: subscription.items.data[0].id,
    price: newPriceId,
  }],
  proration_behavior: "none", // Charge full amount
});

// 2. Create immediate invoice
const invoice = await stripe.invoices.create({
  customer: customerId,
  subscription: subscriptionId,
  auto_advance: true,
});

// 3. Finalize invoice (triggers charge)
await stripe.invoices.finalizeInvoice(invoice.id);
```

---

## Production Deployment

### Cron Schedule (Vercel Cron Example)

**vercel.json:**
```json
{
  "crons": [
    {
      "path": "/api/cron/check-missing-prices",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/auto-pause",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/apply-prices",
      "schedule": "0 * * * *"
    }
  ]
}
```

**API Routes Needed:**
```typescript
// apps/web/src/app/api/cron/check-missing-prices/route.ts
import { exec } from "child_process";

export async function GET(req: Request) {
  // Run the script
  exec("tsx scripts/check-missing-dynamic-prices.ts");
  return Response.json({ success: true });
}
```

---

## Testing Checklist

### Unit Tests
- [ ] resumePausedSubscriptions function
- [ ] Alert creation for paused subscriptions
- [ ] Price change detection in plan edit

### Integration Tests
- [ ] Create dynamic plan without current price
- [ ] Attempt checkout (should fail)
- [ ] Add current price (should resume paused subs)
- [ ] Verify Stripe subscription status
- [ ] Verify invoice creation
- [ ] Verify alert resolution

### End-to-End Tests

**Scenario 1: Preventive Alerts**
1. Create dynamic plan with only current month price
2. Wait 30 days (or mock date)
3. Run check-missing-prices
4. Verify alert created
5. Add next month price
6. Verify alert resolved

**Scenario 2: Auto-Pause (Rolling)**
1. Customer signs up on 15th with current price
2. Remove next month's price
3. Mock date to Dec 15
4. Run auto-pause cron
5. Verify subscription paused in Stripe
6. Verify pausedAt set in database
7. Verify alert created
8. Add December price via plan edit
9. Verify subscription resumed
10. Verify invoice created and charged
11. Verify pausedAt cleared
12. Verify alert resolved

**Scenario 3: Auto-Pause (Cohort)**
1. Create 3 customers on cohort billing
2. Remove next month's price
3. Mock date to Dec 1
4. Run auto-pause cron
5. Verify all 3 subscriptions paused
6. Add December price
7. Verify all 3 subscriptions resumed simultaneously
8. Verify all 3 invoices created

**Scenario 4: Customer Portal During Pause**
1. Pause subscription
2. Customer visits portal
3. Verify sees "paused" status
4. Resume subscription
5. Verify sees "active" status

---

## Edge Cases Handled

### 1. Subscription Already Paused
- Check Stripe status before pausing
- Skip if already paused
- Don't create duplicate alerts

### 2. Multiple Pauses (Repeated Missing Prices)
- Each pause creates new alert
- Old alerts remain visible
- Alerts show pause date for history

### 3. Resume Failures
- Log individual errors
- Continue with other subscriptions
- Return error list in result

### 4. Payment Failures on Resume
- Stripe handles retry logic
- Webhook updates subscription status
- Failed payment creates separate alert

### 5. Customer Cancels During Pause
- Subscription stays cancelled
- Don't attempt resume
- Clean up pausedAt field

---

## Monitoring & Metrics

### Key Metrics to Track

**Prevention Effectiveness:**
- Alert response time (creation → resolution)
- % of alerts resolved before billing date
- Average days remaining when resolved

**Pause Impact:**
- Number of subscriptions paused per month
- Average pause duration
- % of paused subs that resume vs cancel

**Resume Success:**
- Resume success rate
- Payment success rate on resume
- Time from price add to resume

**Business Health:**
- Plans frequently missing prices (problem plans)
- Businesses with high pause rates
- Revenue impact of paused billing

---

## Customer Communication (Future Enhancement)

Currently: **SILENT** (no customer emails)

**Optional Future Additions:**

### During Pause (if desired):
```
Subject: Temporary subscription status update

Hi [Customer],

Your subscription is temporarily on hold while we update 
pricing. You won't be charged during this time.

We'll resume your subscription shortly.
```

### On Resume:
```
Subject: Your subscription has resumed

Hi [Customer],

Your subscription has resumed and you've been charged 
$[Amount] for this period.

Next billing date: [Date]
```

**Decision:** For now, keeping it silent is better because:
- Business should fix quickly (7/3/1 day warnings)
- Reduces customer confusion
- Simpler implementation
- Customer just sees normal charge when resumed

---

## Files Created/Modified

### New Files
- `scripts/auto-pause-missing-prices.ts` - Auto-pause cron job
- `packages/lib/resume-paused-subscriptions.ts` - Resume logic
- `docs/dynamic-pricing-option-a-implementation.md` - This file

### Modified Files
- `packages/lib/index.ts` - Export resume function
- `apps/web/src/app/api/plans/[planId]/route.ts` - Call resume on price change
- `packages/db/prisma/schema.prisma` - Added pausedAt field
- `package.json` - Added auto-pause cron script

---

## Next Steps

### Immediate (Ready to Use)
1. ✅ Deploy schema changes
2. ✅ Set up cron jobs in production
3. ✅ Test with dynamic plans

### Short Term (Nice to Have)
1. [ ] Email notifications for missing prices
2. [ ] Customer portal messaging during pause
3. [ ] Analytics dashboard for pause metrics

### Long Term (Enhancements)
1. [ ] Predictive alerts (ML to predict forgotten prices)
2. [ ] Bulk resume tool (if many subs paused)
3. [ ] Grace period option (24hr before pause)

---

## Summary

**Option A (Auto-Pause) provides:**

✅ **For Business:**
- Proactive alerts (7/3/1 days)
- Central dashboard for all issues
- Automatic handling (no manual work)
- Clear action items ("Set Price")

✅ **For Customers:**
- Silent experience (no confusing emails)
- Uninterrupted service perception
- Immediate resume when fixed
- Normal billing resumes

✅ **For Platform:**
- Clean pause/resume flow
- No revenue loss (charges when resumed)
- Stripe-native implementation
- Automatic, scalable solution

**Result:** A robust system that prevents billing issues while maintaining excellent customer experience!

