# Phase 4: Consumer UI - Implementation Plan

**Date:** 2025-11-14  
**Status:** PLANNING  
**Branch:** `feature/phase4-consumer-ui` (to be created)

---

## 🎯 Phase 4 Objectives

Build the **customer-facing** subscription experience:
1. Public membership/plan browse pages (no auth required)
2. Plan selection and comparison
3. Stripe Checkout flow for subscriptions
4. Member portal (authenticated consumers)
5. Subscription management (pause, resume, cancel)

**Key Principle:** Stripe is the source of truth - we fetch data from Stripe API, not our DB

---

## 📋 Phase 4 Tasks (From Mission File)

### 1. Public Membership Browse Page
- [ ] Route: `/[slug]/plans` (public business page)
- [ ] Display all active memberships
- [ ] Show plans within each membership
- [ ] Pricing, intervals, features displayed
- [ ] "Subscribe" buttons → checkout

### 2. ~~Plan Selection & Comparison~~ (SKIPPED)
- Removed from Phase 4 scope
- Simple list view is sufficient for MVP

### 3. Checkout Flow (Stripe Checkout)
- [ ] API: Create Stripe Checkout Session
- [ ] Redirect to Stripe-hosted checkout
- [ ] Handle success/cancel callbacks
- [ ] Create PlanSubscription record on success
- [ ] Handle NEXT_INTERVAL billing anchor for cohort billing

### 4. Member Portal (Consumer Auth)
- [ ] Consumer sign-in flow (magic links)
- [ ] View active subscriptions (from Stripe)
- [ ] View subscription details
- [ ] Access portal links

### 5. Subscription Management
- [ ] Pause subscription (Stripe API)
- [ ] Resume subscription (Stripe API)
- [ ] Cancel subscription (Stripe API)
- [ ] Update payment method (Stripe portal)
- [ ] View invoices/receipts (Stripe API)

---

## 🏗️ Architecture Overview

### Routes Structure
```
/[slug]/                          # Public business page (already exists)
/[slug]/plans                     # Browse plans (NEW)
/[slug]/plans/[planId]           # Plan details (NEW)
/[slug]/auth/signin              # Consumer sign-in (NEW)
/[slug]/portal                   # Member portal home (EXISTS)
/[slug]/portal/subscriptions     # View subscriptions (NEW)
/[slug]/portal/subscriptions/[id] # Manage subscription (NEW)

API:
/api/checkout/[slug]/session     # Create Stripe Checkout (NEW)
/api/consumer/auth/*             # Consumer auth (EXISTS)
/api/portal/[slug]/subscriptions # Fetch from Stripe (NEW)
```

### Data Flow
```
1. Customer visits /[slug]/plans
   ↓
2. Views plans, clicks "Subscribe"
   ↓
3. API creates Stripe Checkout Session
   ↓
4. Redirects to Stripe (hosted checkout page)
   ↓
5. Stripe processes payment
   ↓
6. Webhook: subscription.created
   ↓
7. Create PlanSubscription record
   ↓
8. Redirect to /[slug]/success
```

---

## 🎨 UI/UX Considerations

### Public Pages (No Auth)
- Clean, marketing-focused design
- Clear pricing display
- Mobile-first responsive
- Fast loading (static generation where possible)

### Portal (Authenticated)
- Dashboard view of all subscriptions
- Clear subscription status indicators
- Easy access to management actions
- Billing history visible

---

## 🔐 Security & Auth

### Consumer Authentication
- Already exists: Consumer model + magic links
- Route: `/api/consumer/auth/*`
- Session management via NextAuth

### Authorization
- Consumers can only see their own subscriptions
- Verify subscription ownership before any action
- Use Stripe customer ID validation

---

## 🧪 Testing Strategy

### What to Test
1. **Public pages render** without auth
2. **Checkout session creation** succeeds
3. **Stripe redirect** works correctly
4. **Webhook handling** creates subscription
5. **Portal auth** gates access correctly
6. **Subscription management** calls Stripe API

### Test Approach
- Unit tests for API routes
- Integration tests for checkout flow
- E2E test for full subscription journey
- Manual test with Stripe test mode

---

## 📦 Implementation Steps (Incremental)

### Step 1: Public Plans Page (30 min)
- Create `/[slug]/plans/page.tsx`
- Fetch memberships + plans for business
- Display in cards/grid
- "Subscribe" buttons (non-functional)
- Deploy & test

### Step 2: Plan Details Page (15 min)
- Create `/[slug]/plans/[planId]/page.tsx`
- Show full plan details
- "Subscribe" button
- Deploy & test

### Step 3: Checkout API (45 min)
- Create `/api/checkout/[slug]/session/route.ts`
- Create Stripe Checkout Session
- Handle NEXT_INTERVAL billing anchor
- Return session URL
- Deploy & test

### Step 4: Wire Up Subscribe Buttons (15 min)
- Add onClick handlers
- Call checkout API
- Redirect to Stripe
- Deploy & test

### Step 5: Success/Cancel Pages (20 min)
- Create `/[slug]/success/page.tsx`
- Create `/[slug]/cancel/page.tsx`
- Display appropriate messages
- Deploy & test

### Step 6: Portal Subscriptions List (30 min)
- Create `/[slug]/portal/subscriptions/page.tsx`
- Fetch subscriptions from Stripe API
- Display with status badges
- Deploy & test

### Step 7: Subscription Management (45 min)
- Create `/[slug]/portal/subscriptions/[id]/page.tsx`
- Add pause/resume/cancel buttons
- Create API routes for each action
- Deploy & test

### Step 8: Polish & E2E Test (30 min)
- Add loading states
- Error handling
- Responsive design tweaks
- Full manual test

**Total Estimated Time:** 3-4 hours

---

## 🚀 Deployment Strategy

Following Phase 3 success:
1. Create feature branch
2. Implement incrementally (8 steps above)
3. Commit & deploy after each step
4. Run automated tests
5. Manual verification
6. Merge to main when complete

---

## ⚠️ Known Challenges

### Challenge 1: Webhook Sync
**Issue:** Subscription created in Stripe, need to sync to our DB  
**Solution:** Use existing webhook handler, add subscription.created event

### Challenge 2: NEXT_INTERVAL Billing
**Issue:** Calculate cohort billing date for membership  
**Solution:** Use `billing_cycle_anchor` in Stripe Checkout Session

### Challenge 3: Consumer Auth
**Issue:** Different from business user auth  
**Solution:** Already implemented, just need to use it

### Challenge 4: Stripe API Latency
**Issue:** Fetching subscriptions from Stripe can be slow  
**Solution:** Cache in database via webhooks, refresh on page load

---

## 📊 Success Criteria

Phase 4 is complete when:
- [ ] Customers can view plans without auth
- [ ] Customers can subscribe via Stripe Checkout
- [ ] Subscriptions appear in member portal
- [ ] Customers can pause/resume/cancel
- [ ] All automated tests pass
- [ ] Manual E2E test successful
- [ ] Deployed to production

---

## 🔄 Post-Phase 4

After completion:
- Customers can self-serve subscribe
- Members can manage their subscriptions
- Business owners get automatic payments
- **Ready for Phase 5:** Email automation & analytics

---

## 📝 Notes

- Focus on Stripe-native approach (no custom billing logic)
- Leverage existing Consumer auth (don't rebuild)
- Use Stripe Checkout (not Payment Element) for speed
- Webhook handling is critical - test thoroughly
- Mobile-first design for consumer pages

---

**Status:** Ready to begin Phase 4!  
**Next Action:** Create feature branch and start Step 1 (Public Plans Page)

