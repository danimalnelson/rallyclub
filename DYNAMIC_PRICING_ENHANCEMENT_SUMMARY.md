# Dynamic Pricing Enhancement - Implementation Summary

**Date:** 2025-11-16  
**Branch:** `feature/refine-dynamic-pricing`

---

## 🎯 Goal Achieved

Transformed dynamic pricing from "fallback to last price" to "**explicit pricing required**" with comprehensive alerts and notifications.

---

## ✅ What's Been Implemented

### 1. **Alert System** (NEW)

**Database:**
- `BusinessAlert` model created
- Types: MISSING_DYNAMIC_PRICE, FAILED_PAYMENT, SUBSCRIPTION_PAUSED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_PAST_DUE
- Severities: INFO, WARNING, URGENT, CRITICAL

**API Routes:**
- `GET /api/alerts?businessId=X` - Fetch alerts with filters
- `POST /api/alerts/[id]/resolve` - Mark alert as resolved

**Dashboard:**
- `/app/[businessId]/alerts` - New alerts page
- Summary cards for each alert type
- Filter by type and resolved status
- Quick actions: "Set Price", "Resolve"

### 2. **Missing Price Notifications**

**Cron Job:** `check-missing-dynamic-prices.ts`
```bash
pnpm cron:check-missing-prices
```

**Schedule:**
- **7 days before** next month → WARNING alert
- **3 days before** next month → URGENT alert
- **1 day before** next month → CRITICAL alert

**Actions:**
- Creates BusinessAlert in dashboard
- Tracks notification timing (notifiedAt7Days, notifiedAt3Days, notifiedAt1Day)
- Email hooks ready (commented out, ready to implement)

### 3. **Checkout Protection**

**Updated:** `apps/web/src/app/api/checkout/[slug]/[planId]/confirm/route.ts`

**Behavior:**
- Checks if dynamic plan has `stripePriceId`
- If missing → Returns 503 Service Unavailable
- Error message: "This plan is temporarily unavailable. The business owner needs to set pricing for the current month."
- Prevents new signups until price is set

### 4. **Schema Updates**

**PriceQueueItem:**
```prisma
notifiedAt7Days  DateTime?  // NEW
notifiedAt3Days  DateTime?  // NEW  
notifiedAt1Day   DateTime?  // Existing
```

**Business Model:**
```prisma
alerts  BusinessAlert[]  // NEW relation
```

### 5. **Documentation**

**Created:**
1. `docs/dynamic-pricing-implementation.md` - Original implementation
2. `docs/dynamic-pricing-missing-price-handling.md` - NEW: Missing price scenarios

---

## 🚧 Pending User Decisions

### Critical Decision: Missing Price at Billing Time

**Question:** What happens when a customer's billing date arrives and no price is set?

**Options:**

#### Option A: Auto-Pause (Recommended)
- Subscription paused via Stripe `pause_collection`
- Customer notified: "Temporarily paused - pricing being updated"
- When price added: Auto-resume + charge immediately
- **Pros:** No free service, clear communication
- **Cons:** Customer experience interrupted

#### Option B: Skip Billing Cycle
- Don't charge customer this month
- Extend subscription by 1 month
- Customer gets free month
- **Pros:** Customer goodwill
- **Cons:** Revenue loss, tracking complexity

#### Option C: Cancel Subscription
- Cancel and require re-signup
- **Pros:** Clean break
- **Cons:** Lose customer

**Your choice will determine the implementation of:**
- Subscription pause logic (in webhook handler or cron)
- Resume logic (when price is added late)
- Customer communication

---

## 📋 Remaining TODOs

### High Priority

1. **Email Notification Service** (pending)
   - Currently commented out in `check-missing-dynamic-prices.ts`
   - Need to create email templates
   - Integrate with Resend or email provider
   - Templates needed:
     - Missing price reminders (7/3/1 day)
     - Subscription paused notification
     - Subscription resumed notification

2. **Auto-Pause Logic** (pending user decision)
   - Implement chosen option (A, B, or C)
   - Update Stripe webhook handler or create new cron
   - Handle both Rolling and Cohort billing
   - Test with Stripe test mode

3. **Late Price Addition Handler** (pending user decision)
   - When price is added after billing date
   - Resume paused subscriptions
   - Charge immediately
   - Send customer emails

### Medium Priority

4. **Update Transactions Page**
   - Remove subscription status alerts (move to Alerts page)
   - Focus purely on revenue and payment data
   - Show: transactions, payments, refunds, payouts
   - Remove: subscription lifecycle events

5. **Webhook Integration**
   - Create/update webhook handler for:
     - Failed payments → Create FAILED_PAYMENT alert
     - Subscription paused → Create SUBSCRIPTION_PAUSED alert
     - Subscription cancelled → Create SUBSCRIPTION_CANCELLED alert
     - Subscription past_due → Create SUBSCRIPTION_PAST_DUE alert

### Low Priority

6. **Testing**
   - End-to-end test with dynamic pricing
   - Test all 3 scenarios (new signup, billing date, late price)
   - Test with both Rolling and Cohort billing
   - Test notification timing

7. **Monitoring**
   - Set up cron job monitoring
   - Alert if cron jobs fail
   - Track alert resolution rates

---

## 🚀 How to Use (Current State)

### For Business Owners

1. **Create Dynamic Plan:**
   ```
   - Go to Plans → New Plan
   - Select "Dynamic (price varies)"
   - Fill in monthly price table (6 months shown)
   - Current month is required
   - Save
   ```

2. **Monitor Alerts:**
   ```
   - Go to Alerts page
   - See missing prices, failed payments, etc.
   - Click "Set Price" to navigate to plan
   - Click "Resolve" to dismiss alert
   ```

3. **Receive Emails:**
   ```
   - 7 days before: Reminder to set price
   - 3 days before: Urgent reminder
   - 1 day before: Critical reminder
   - (Email service pending implementation)
   ```

### For Customers

1. **Attempting Signup (No Price):**
   ```
   - See friendly error message
   - "Plan temporarily unavailable"
   - Cannot complete checkout
   ```

2. **At Billing Time (No Price):**
   ```
   - (Behavior depends on user decision)
   - Option A: Subscription paused, notified
   - Option B: Free month, notified
   - Option C: Subscription cancelled
   ```

### For Developers

1. **Run Cron Jobs Manually:**
   ```bash
   # Check for missing prices (creates alerts)
   pnpm cron:check-missing-prices
   
   # Apply scheduled prices
   pnpm cron:apply-prices
   ```

2. **Production Setup:**
   ```yaml
   # Schedule these in production cron (Vercel, GitHub Actions, etc.)
   - cron: "0 0 * * *"  # Daily at midnight
     run: pnpm cron:check-missing-prices
   
   - cron: "0 * * * *"  # Hourly
     run: pnpm cron:apply-prices
   ```

---

## 📊 Scenarios Covered

### ✅ Scenario 1: Create Dynamic Plan
- Business sets prices for 6 months
- Current month required
- Future months optional
- Queue items created

### ✅ Scenario 2: Missing Price Alert
- 7/3/1 days before next month
- Alert created in dashboard
- Email queued (pending implementation)
- Business can set price

### ✅ Scenario 3: New Signup (No Price)
- Checkout blocked
- Friendly error message
- Customer sees "Plan temporarily unavailable"

### ⏳ Scenario 4: Billing Date (No Price) - NEEDS DECISION
- Rolling: Individual customers affected
- Cohort: All customers affected simultaneously
- Options A/B/C (user must choose)

### ⏳ Scenario 5: Late Price Addition - NEEDS DECISION
- Price added after billing date
- Resume logic needed (if Option A chosen)
- Charge customers immediately
- Send notifications

---

## 🎨 UI/UX Enhancements

### Alerts Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Alerts                                                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Total: 5] [💰 Missing: 2] [💳 Failed: 1] [⏸️ Paused: 2] │
│                                                          │
│  [Unresolved] [All]                                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 💰 Missing Price: Vintage Selection      CRITICAL │  │
│  │ No price set for December. 24 subscribers.        │  │
│  │                     [Set Price] [Resolve]          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Monthly Price Table (PlanForm)
```
┌──────────────────────────────────────┐
│ Month          Price      Status     │
│ ─────────────────────────────────── │
│ Nov 2025 ⭐    $99.99    Active      │
│ Dec 2025       $129.99   Scheduled   │
│ Jan 2026       (empty)   Required!   │
└──────────────────────────────────────┘
```

---

## 🔒 Security & Validation

**Validations Added:**
- ✅ Cannot activate dynamic plan without current price
- ✅ Cannot checkout without stripePriceId
- ✅ Alert access restricted to business users
- ✅ Plan edit restricted to OWNER/ADMIN roles

---

## 📈 Next Sprint Recommendations

### Week 1: Decision & Core Logic
1. **User decides** on Option A/B/C for missing prices
2. Implement chosen option
3. Test with Stripe test mode

### Week 2: Communication
4. Create email templates
5. Integrate email service
6. Test email notifications

### Week 3: Webhooks & Monitoring
7. Update webhook handlers for all alert types
8. Add monitoring for cron jobs
9. Update Transactions page

### Week 4: Polish & Launch
10. End-to-end testing
11. Documentation for business owners
12. Deploy to production
13. Set up production cron jobs

---

## 🤔 Open Questions

1. **Missing price handling:** Option A, B, or C?
2. **Customer communication tone:** Apologetic or matter-of-fact?
3. **Paused subscription access:** Keep access or cut off?
4. **Grace period:** Give 24 hours after billing date?
5. **Email provider:** Using Resend (as seen in project)?
6. **Cron hosting:** Vercel Cron, GitHub Actions, or external?
7. **Platform fees:** How to handle for skipped/paused billing?

---

## 📚 Files Modified/Created

### Modified
- `packages/db/prisma/schema.prisma` - Added BusinessAlert model
- `apps/web/src/components/plans/PlanForm.tsx` - Monthly price table
- `apps/web/src/app/api/plans/create/route.ts` - Handle monthlyPrices
- `apps/web/src/app/api/plans/[planId]/route.ts` - Sync price queue
- `apps/web/src/app/api/checkout/[slug]/[planId]/confirm/route.ts` - Prevent signup
- `package.json` - Added cron scripts

### Created
- `scripts/check-missing-dynamic-prices.ts` - Alert cron job
- `scripts/apply-dynamic-prices.ts` - Price application cron job
- `apps/web/src/app/api/alerts/route.ts` - Alerts API
- `apps/web/src/app/api/alerts/[alertId]/resolve/route.ts` - Resolve API
- `apps/web/src/app/app/[businessId]/alerts/page.tsx` - Alerts dashboard
- `docs/dynamic-pricing-implementation.md` - Original docs
- `docs/dynamic-pricing-missing-price-handling.md` - Missing price scenarios
- `DYNAMIC_PRICING_ENHANCEMENT_SUMMARY.md` - This file

---

## 🎉 Success Metrics

Once fully implemented, measure:
- **Alert Response Time:** How quickly business owners set missing prices
- **Subscription Retention:** Impact of chosen missing price strategy
- **Customer Support Tickets:** Related to pricing/pausing
- **Revenue Impact:** Any losses from skipped billing cycles
- **Email Open Rates:** For missing price reminders

---

## ✨ Summary

You now have a robust system for managing dynamic pricing with:
- ✅ Explicit monthly pricing (no fallback)
- ✅ Proactive alerts (7/3/1 day reminders)
- ✅ Central dashboard for all business alerts
- ✅ Checkout protection (no signup without price)
- ✅ Automated price application
- ⏳ Pending: Missing price handling strategy (awaiting your decision)

**Next Step:** Choose Option A, B, or C for handling missing prices at billing time, and we'll complete the implementation!

