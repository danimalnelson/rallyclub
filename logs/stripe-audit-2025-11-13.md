# Stripe Integration Audit

**Date:** November 13, 2025  
**Branch:** `feature/subscription-modeling-phase1`  
**Auditor:** Phase 0 - Stripe Code Audit  
**Status:** ✅ **MOSTLY STRIPE-NATIVE** (Good foundation!)

---

## 🎯 Audit Summary

### Overall Assessment: **B+ (Very Good)**

The existing Stripe integration is **already mostly Stripe-native**! The codebase correctly:
- ✅ Uses Stripe Checkout for payments
- ✅ Lets Stripe handle subscription creation
- ✅ Uses webhooks to sync state
- ✅ Stores minimal data (just IDs + cached status)
- ✅ Fetches full subscription from Stripe when needed

**Minor improvements needed** for new membership/plan system.

---

## 📂 Files Audited

### Core Stripe Files
1. ✅ `packages/lib/stripe.ts` - **Excellent**
2. ✅ `apps/web/src/app/api/stripe/webhook/route.ts` - **Very Good**
3. ✅ `apps/web/src/app/api/checkout/[slug]/session/route.ts` - **Excellent**

### Supporting Files
4. `apps/web/src/app/api/stripe/connect/account-link/route.ts` - Stripe Connect (good)
5. `apps/web/src/app/api/portal/[slug]/link/route.ts` - Customer Portal (good)
6. `apps/web/src/app/api/plans/create/route.ts` - Creates Products/Prices
7. Various UI files (display only, no billing logic)

---

## ✅ What's Already Stripe-Native

### 1. **Checkout Flow** (`checkout/[slug]/session/route.ts`)

**✅ EXCELLENT - Fully Stripe-Native**

```typescript
// Creates Stripe Checkout Session
const session = await createConnectedCheckoutSession({
  accountId: business.stripeAccountId,
  priceId: price.stripePriceId,  // ✅ Uses Stripe Price
  // ✅ Stripe handles entire payment flow
});
```

**What it does right:**
- Uses Stripe Checkout (hosted, PCI-compliant)
- Passes `stripePriceId` to Stripe
- Stripe creates subscription automatically
- No custom billing logic
- Application fee handled by Stripe
- Automatic tax via Stripe

**Score:** 10/10 🌟

---

### 2. **Webhook Handling** (`stripe/webhook/route.ts`)

**✅ VERY GOOD - Correctly syncs from Stripe**

```typescript
// Webhook creates/updates subscription in DB
await prisma.subscription.upsert({
  where: { stripeSubscriptionId: subscriptionId },
  create: {
    stripeSubscriptionId: subscriptionId,  // ✅ Just store ID
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),  // ✅ Cache from Stripe
    status: subscription.status as any,  // ✅ Mirror Stripe status
  },
});
```

**Webhooks handled:**
- ✅ `checkout.session.completed` - Creates subscription
- ✅ `customer.subscription.created/updated` - Syncs status
- ✅ `customer.subscription.deleted` - Marks canceled
- ✅ `invoice.paid` - Records transaction
- ✅ `invoice.payment_failed` - Updates status
- ✅ `charge.refunded` - Records refund
- ✅ `account.updated` - Syncs Stripe Connect account

**What it does right:**
- Minimal DB storage (ID, status, dates)
- Fetches full subscription from Stripe when needed (line 186)
- Uses webhook for all state changes
- No custom billing calculations

**Minor Issues:**
- ❌ Line 207: Uses `as any` for status (should use string)
- ⚠️ Lines 217-221: Updates `Member.status` separately (could simplify)

**Score:** 9/10 🌟

---

### 3. **Stripe Utilities** (`packages/lib/stripe.ts`)

**✅ EXCELLENT - Clean abstraction**

```typescript
// Helper functions that call Stripe API
export function getStripeClient(accountId?: string): Stripe
export async function createConnectedCheckoutSession(...)
export async function createCustomerPortalLink(...)
export async function createConnectedProduct(...)
export async function createConnectedPrice(...)
```

**What it does right:**
- Clean API wrappers
- Handles Stripe Connect accounts
- No business logic, just API calls
- Type-safe

**Score:** 10/10 🌟

---

## ⚠️ Areas for Improvement

### 1. **Subscription Model** (Minor)

**Current:**
```prisma
model Subscription {
  stripeSubscriptionId String @unique
  currentPeriodEnd     DateTime
  status               SubscriptionStatus  // ❌ Enum (limited)
}
```

**Issue:** Uses enum for status, limits to predefined values.

**Fix for new model:**
```prisma
model PlanSubscription {
  stripeSubscriptionId String @unique
  status               String  // ✅ Mirror Stripe exactly
  currentPeriodEnd     DateTime
}
```

**Impact:** Low - just use string in new model

---

### 2. **Member Status Duplication** (Minor)

**Current:** (Lines 217-221, 242-254 in webhook)

```typescript
// Update member status separately from subscription
await prisma.member.update({
  where: { id: member.id },
  data: {
    status: mapSubscriptionStatusToMemberStatus(subscription.status),
  },
});
```

**Issue:** Duplicates status tracking. `Member.status` derived from `Subscription.status`.

**Recommendation:**
- Keep `Member` as just relationship (business ↔ consumer)
- Status lives on `PlanSubscription` only
- Compute member status from their active subscriptions

**Impact:** Low - design decision for new model

---

### 3. **Missing Webhook Events** (Enhancement)

**Current:** Handles 7 event types

**Missing (for new features):**
- `customer.subscription.paused` - When pause_collection set
- `customer.subscription.resumed` - When pause removed
- `customer.subscription.trial_will_end` - 3 days before trial ends
- `invoice.upcoming` - 7 days before renewal (for dynamic pricing reminder)
- `payment_method.attached` - When customer adds card

**Recommendation:** Add these for new membership system

**Impact:** Medium - needed for pause/resume and dynamic pricing

---

### 4. **No Billing Cycle Anchor Usage** (Gap)

**Current:** Doesn't use `billing_cycle_anchor`

**Needed for:** NEXT_INTERVAL memberships

**Example:**
```typescript
// For NEXT_INTERVAL (cohort billing)
await stripe.subscriptions.create({
  customer: customerId,
  items: [{ price: priceId }],
  billing_cycle_anchor: Math.floor(nextCohortDate.getTime() / 1000),  // NEW
  proration_behavior: 'none',
});
```

**Recommendation:** Add to checkout session creation for new memberships

**Impact:** High - required for Phase 2

---

### 5. **Pause/Resume Not Implemented** (Missing Feature)

**Current:** No pause functionality

**Needed for:** Member portal pause feature

**Implementation:**
```typescript
// Pause subscription
await stripe.subscriptions.update(stripeSubscriptionId, {
  pause_collection: {
    behavior: 'void',  // Don't charge
  },
});

// Resume subscription
await stripe.subscriptions.update(stripeSubscriptionId, {
  pause_collection: '',  // Remove pause
});
```

**Recommendation:** Add API route + webhook handling

**Impact:** High - key feature for Phase 2

---

## 📊 Stripe-Native Compliance Score

| Category | Current Score | Target | Status |
|----------|---------------|--------|--------|
| **Checkout** | 10/10 | 10/10 | ✅ Perfect |
| **Webhooks** | 9/10 | 10/10 | ✅ Excellent |
| **Utilities** | 10/10 | 10/10 | ✅ Perfect |
| **Data Model** | 8/10 | 10/10 | ⚠️ Minor fixes |
| **Feature Coverage** | 6/10 | 10/10 | ⚠️ Missing pause, cohort billing |

**Overall:** 8.6/10 ⭐⭐⭐⭐ (Very Good)

---

## 🔧 Recommended Changes

### Priority 1: Required for New Model

1. **Use string for subscription status** (not enum)
   - File: New `PlanSubscription` model
   - Change: `status String` instead of `status SubscriptionStatus`
   - Reason: Stripe may add new statuses

2. **Add billing_cycle_anchor support**
   - File: `createConnectedCheckoutSession` in `stripe.ts`
   - Change: Accept `billingCycleAnchor?: number` parameter
   - Reason: NEXT_INTERVAL memberships need cohort billing

3. **Simplify Member model**
   - File: `schema.prisma`
   - Change: Remove `Member.status`, derive from subscriptions
   - Reason: Single source of truth (Subscription)

### Priority 2: New Features

4. **Add pause/resume API routes**
   - Files: `apps/web/src/app/api/subscriptions/[id]/pause/route.ts`
   - Logic: Call `stripe.subscriptions.update({ pause_collection })`

5. **Add missing webhook handlers**
   - File: `stripe/webhook/route.ts`
   - Events: `paused`, `resumed`, `trial_will_end`, `invoice.upcoming`

6. **Fetch subscription details when needed**
   - Pattern: Don't store everything, fetch from Stripe
   - Example: Portal shows real-time data from `stripe.subscriptions.retrieve()`

### Priority 3: Nice to Have

7. **Cache subscription items**
   - Store: `currentPrice`, `currentInterval` for quick display
   - Update: Via `subscription.updated` webhook

8. **Add subscription schedules**
   - For: Plan upgrades/downgrades taking effect later
   - Use: `stripe.subscriptionSchedules`

---

## 🚀 Migration Path

### Phase 0 (Current - Audit)
✅ **COMPLETE** - Existing code is Stripe-native!

### Phase 1 (Data Model)
1. Create new models (`Membership`, `Plan`, `PlanSubscription`)
2. Use `status: String` (not enum)
3. Add fields for `billing_cycle_anchor`
4. Keep existing models untouched (side-by-side)

### Phase 2 (Stripe Integration)
5. Update `createConnectedCheckoutSession` to accept `billingCycleAnchor`
6. Add pause/resume API routes
7. Add new webhook handlers
8. Create migration script (old subscriptions → new)

### Phase 3 (UI)
9. Build membership/plan creation UI
10. Build member portal with pause/resume
11. Test with Stripe test mode

### Phase 4 (Production)
12. Migrate existing subscriptions
13. Deprecate old models
14. Deploy to production

---

## ✅ Stripe Best Practices (Already Following!)

1. ✅ **Use Stripe Checkout** - Not building custom payment forms
2. ✅ **Webhook-driven** - All state changes come from Stripe
3. ✅ **Minimal storage** - Just IDs and cached data
4. ✅ **Fetch when needed** - Line 186 fetches full subscription
5. ✅ **Stripe Connect** - Properly using connected accounts
6. ✅ **Idempotency** - Webhook event ID tracking (line 490)
7. ✅ **Security** - Cross-tenant checks (line 55-57)
8. ✅ **Error handling** - Try/catch + logging
9. ✅ **Type safety** - Using Stripe TypeScript SDK

**Excellent foundation!** 🎉

---

## 🎯 Action Items

### Immediate (Before Phase 1)
- [x] Audit complete
- [ ] Review findings with team
- [ ] Approve migration plan

### Phase 1 (Data Model)
- [ ] Create new models with string status
- [ ] Add billing_cycle_anchor fields
- [ ] Keep old models (side-by-side)

### Phase 2 (Implementation)
- [ ] Update checkout for cohort billing
- [ ] Add pause/resume routes
- [ ] Add webhook handlers
- [ ] Test thoroughly

---

## 📝 Conclusion

**Verdict:** ✅ **APPROVED FOR PHASE 1**

The existing Stripe integration is **excellent** and already follows Stripe-native principles. The codebase:
- Correctly uses Stripe as source of truth
- Properly syncs via webhooks
- Stores minimal data
- Fetches from Stripe when needed

**Minor improvements needed:**
- String status (not enum)
- Billing cycle anchor support
- Pause/resume feature
- Additional webhook events

**No major refactoring required!** Just extend the existing patterns for new membership/plan system.

---

**Audit Status:** ✅ COMPLETE  
**Recommendation:** PROCEED TO PHASE 1  
**Risk Level:** 🟢 LOW (building on solid foundation)

