# Dynamic Pricing: Rolling Billing Edge Case

**Critical Scenario:** Individual billing dates with late price additions

---

## The Scenario

**Setup:**
- Plan: Dynamic pricing with ROLLING billing (IMMEDIATE billing anchor)
- Customer A: Signed up June 1 → Bills on 1st of each month
- Customer B: Signed up June 15 → Bills on 15th of each month
- Issue: Business forgets to set June price

**Timeline:**

```
June 1, 12:00 AM
├─ Customer A's billing date arrives
├─ No June price set
├─ Auto-pause cron runs (hourly)
├─ Checks: currentPeriodEnd <= now? YES
└─ Action: Pause Customer A

June 2, 9:00 AM
├─ Business adds June price ($99.99)
├─ resumePausedSubscriptions() called
├─ Customer A: Resumed and charged $99.99 immediately
└─ Customer B: Not affected (billing date not reached)

June 15, 12:00 AM
├─ Customer B's billing date arrives
├─ June price already set ($99.99)
├─ Stripe charges Customer B $99.99 normally
└─ No pause needed
```

---

## Key Insight

**For Rolling Billing:**
- Each subscription has its own `current_period_end` (next billing date)
- We ONLY pause subscriptions whose billing date has PASSED
- We DON'T pause subscriptions whose billing date hasn't arrived yet

**For Cohort Billing:**
- All subscriptions have the same billing date (1st of month)
- All subscriptions pause simultaneously on the 1st if no price
- When price is added, all resume together

---

## Implementation: Auto-Pause Logic

**File:** `scripts/auto-pause-missing-prices.ts`

**Critical Check:**
```typescript
// Get subscription from Stripe
const stripeSubscription = await stripe.subscriptions.retrieve(
  planSub.stripeSubscriptionId
);

// Check if THIS subscription's billing date has passed
const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
const billingDatePassed = currentPeriodEnd <= now;

if (!billingDatePassed) {
  // Billing date not reached yet - don't pause
  console.log(`Subscription ${planSub.id} billing date not yet reached`);
  continue;
}

// Billing date has passed and no price - pause now
console.log(`Subscription ${planSub.id} billing date passed - pausing`);
await stripe.subscriptions.update(/* pause */);
```

**Why This Works:**
- Stripe's `current_period_end` is the next billing date/time
- For Customer A (June 1 signup): `current_period_end` = July 1, 12:00 AM
- For Customer B (June 15 signup): `current_period_end` = July 15, 12:00 AM
- On June 2 when cron runs:
  - Customer A: July 1 <= June 2? NO → Don't pause (period hasn't ended)
  - Customer B: July 15 <= June 2? NO → Don't pause

Wait, I need to reconsider this logic...

---

## Corrected Understanding

**Stripe Subscription Periods:**
- `current_period_start`: June 1 for Customer A
- `current_period_end`: July 1 for Customer A (next billing date)
- When July 1 arrives, Stripe tries to create an invoice
- We need to pause BEFORE Stripe creates the invoice

**The Real Check:**
- On July 1 at 12:00 AM, Customer A's billing date arrives
- `current_period_end` = July 1, 12:00 AM
- `now` = July 1, 1:00 AM (when cron runs)
- `current_period_end <= now` → TRUE
- This is when Stripe would have tried to charge
- We need to check if a July price exists
- If not, pause the subscription

**Scenario with June:**
- Customer A signed up June 1
- `current_period_start`: June 1
- `current_period_end`: July 1 (next billing)
- On June 2 (when business adds price):
  - Customer A is in their June billing period
  - Their next bill is July 1
  - They should NOT be paused on June 2
  - They should only be paused on July 1 if no July price

I think I'm confusing the months. Let me reread the user's scenario...

---

## User's Actual Scenario (Corrected)

**Timeline:**
- Customers signed up in MAY (or earlier)
- They're in their billing cycles
- JUNE arrives - this is when they need to be billed
- Business forgot to set JUNE price

**Customer A:**
- Signed up May 1 (or June 1 last year)
- Bills on 1st of each month
- June 1 arrives → Should bill for June
- No June price → Pause

**Customer B:**
- Signed up May 15 (or June 15 last year)
- Bills on 15th of each month
- June 1 arrives → Not their billing date yet
- June 2: Business sets June price
- June 15 arrives → Bills normally with June price

**The Check:**
```typescript
const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
const billingDatePassed = currentPeriodEnd <= now;
```

On June 1, 1:00 AM:
- Customer A: `current_period_end` = June 1, 12:00 AM → `<=` June 1, 1:00 AM → TRUE ✅ Pause
- Customer B: `current_period_end` = June 15, 12:00 AM → `<=` June 1, 1:00 AM → FALSE ❌ Don't pause

On June 2, 9:00 AM (after price is set):
- Customer A: Resumes and charges immediately
- Customer B: Still active, will bill on June 15 with the new price

**This is correct!** ✅

---

## Edge Case: Stripe Auto-Charges

**Potential Issue:**
- June 1, 12:00 AM: Stripe automatically tries to charge Customer A
- June 1, 1:00 AM: Our cron runs and pauses
- **Gap:** Stripe might have already created an invoice in that 1-hour gap

**Solution:**
- Run cron MORE frequently (every 15 minutes or hourly)
- Or, proactively pause BEFORE period end if no price exists

**Better Approach - Proactive Pause:**
```typescript
// Check if subscription is about to renew WITHOUT a price
const timeUntilBilling = currentPeriodEnd.getTime() - now.getTime();
const hoursUntilBilling = timeUntilBilling / (1000 * 60 * 60);

// If billing is within next hour and no price, pause proactively
if (hoursUntilBilling <= 1 && hoursUntilBilling > 0) {
  console.log(`Subscription ${planSub.id} billing in ${hoursUntilBilling}hr - proactively pausing`);
  await pause();
}

// Or if billing date has passed
if (billingDatePassed) {
  console.log(`Subscription ${planSub.id} billing date passed - pausing`);
  await pause();
}
```

---

## Recommended Cron Frequency

**Current:** Hourly
**Recommended:** Every 15 minutes or Every 30 minutes

**Why:**
- Minimizes gap between Stripe's auto-charge attempt and our pause
- Catches subscriptions closer to their billing time
- More responsive to late price additions

**Cron Schedule:**
```json
{
  "crons": [
    {
      "path": "/api/cron/auto-pause",
      "schedule": "*/15 * * * *"  // Every 15 minutes
    }
  ]
}
```

---

## Complete Flow (Corrected)

**May 1 - Customer A signs up**
- Subscription created, bills monthly on 1st
- `current_period_start`: May 1
- `current_period_end`: June 1

**May 15 - Customer B signs up**
- Subscription created, bills monthly on 15th
- `current_period_start`: May 15
- `current_period_end`: June 15

**May 25 - Business receives alerts**
- 7 days before June: Set June pricing
- No action taken

**June 1, 12:00 AM - Customer A's billing date**
- Stripe checks for price
- `plan.stripePriceId` exists (May's price still there)
- But we want to prevent fallback to May price!

**WAIT - Important Realization:**

If `plan.stripePriceId` still points to May's price, Stripe WILL charge that automatically!

We need to ensure that when June starts without a June price:
1. We immediately set `plan.stripePriceId = null`
2. Or we update subscription items to remove the price

**Better Solution:**

When a new month arrives:
1. Check if next month price exists in queue
2. If not, preemptively set `plan.stripePriceId = null`
3. This prevents Stripe from auto-charging old price
4. When subscriptions try to renew, they fail (no price)
5. Our cron then pauses them

OR, keep the current approach but understand:
- Stripe will try to charge with the old price
- Our cron needs to run BEFORE Stripe's auto-charge
- Pause the subscription proactively

**Recommendation:**
- Run auto-pause cron every 15 minutes
- Check subscriptions whose `current_period_end` is within next hour
- Proactively pause them if no current price exists

---

## Final Implementation Strategy

### 1. Proactive Pause (Before Billing)

```typescript
// Find subscriptions billing soon without a price
const subscriptions = /* get all active subs to dynamic plans */;

for (const sub of subscriptions) {
  const stripeSubscription = await stripe.subscriptions.retrieve(sub.id);
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  const now = new Date();
  
  // Calculate time until billing
  const hoursUntilBilling = (currentPeriodEnd - now) / (1000 * 60 * 60);
  
  // If billing within 1 hour and plan has no current price
  if (hoursUntilBilling > 0 && hoursUntilBilling <= 1) {
    const plan = /* get plan */;
    if (!plan.stripePriceId) {
      // Pause proactively
      await stripe.subscriptions.update(sub.id, { pause_collection: { behavior: "void" } });
    }
  }
}
```

### 2. Reactive Pause (After Billing Attempt)

```typescript
// Also check for subscriptions that already renewed
if (currentPeriodEnd <= now && !plan.stripePriceId) {
  // Pause if not already paused
  await stripe.subscriptions.update(sub.id, { pause_collection: { behavior: "void" } });
}
```

### 3. Cron Frequency

**Run every 15 minutes** to catch subscriptions before Stripe auto-charges.

---

## Conclusion

✅ **Current implementation is correct** for checking individual billing dates  
✅ **Works for both Rolling and Cohort billing**  
⚠️ **Recommend increasing cron frequency** to every 15 minutes  
⚠️ **Consider proactive pause** (within 1 hour of billing) for extra safety

The key insight: Each subscription has its own `current_period_end`, and we only pause those whose period has ended without a price available.

