# Phase 5: Webhook Integration & Subscription Lifecycle

**Date Started:** 2025-11-15  
**Status:** 🚧 IN PROGRESS  
**Branch:** `feature/phase5-webhooks`

---

## 🎯 Objective

Integrate Stripe webhook handlers for the new subscription models (`PlanSubscription`, `Plan`, `Membership`) to complete the subscription lifecycle automation.

---

## 📋 Current State

### ✅ What Exists
- Webhook route at `/api/stripe/webhook/route.ts` (605 lines)
- Webhook handlers for OLD models in webhook route
- Webhook handlers for NEW models in `packages/lib/webhook-handlers.ts`:
  - `syncPlanSubscription()` - Sync subscription status/dates
  - `createPlanSubscriptionFromCheckout()` - Create from checkout
  - `handlePlanSubscriptionDeleted()` - Handle cancellation

### ❌ What's Missing
- Integration of new handlers into webhook route
- Support for both old and new models during transition
- Testing with Stripe CLI
- Email notifications for new subscription events

---

## 🏗️ Implementation Plan

### Task 1: Integrate New Webhook Handlers ✅
- [x] Import new handlers from `@wine-club/lib`
- [ ] Add parallel handling for new models alongside old
- [ ] Update `handleCheckoutCompleted` to support both models
- [ ] Update `handleSubscriptionUpdate` to support both models
- [ ] Update `handleSubscriptionDeleted` to support both models
- [ ] Maintain backward compatibility

### Task 2: Test Webhook Integration
- [ ] Test with Stripe CLI webhook forwarding
- [ ] Verify `checkout.session.completed` creates PlanSubscription
- [ ] Verify `customer.subscription.updated` syncs status
- [ ] Verify `customer.subscription.deleted` marks as canceled
- [ ] Test with real Stripe test mode checkout

### Task 3: Email Notifications
- [ ] Welcome email after PlanSubscription created
- [ ] Payment failed email for new subscriptions
- [ ] Cancellation email for new subscriptions
- [ ] Reuse existing email templates

### Task 4: Documentation & Deployment
- [ ] Update webhook documentation
- [ ] Add troubleshooting guide
- [ ] Deploy to preview
- [ ] Test end-to-end flow
- [ ] Merge to main

---

## 🔄 Data Flow

### Current Flow (OLD Models)
```
Checkout → webhook → Subscription (old) → emails
```

### New Flow (NEW Models - Phase 5)
```
Checkout → webhook → PlanSubscription (new) → emails
                  ↓
            Still support old flow for existing subscriptions
```

### Both Models Supported (Transition Period)
```
checkout.session.completed
  ├─> Check metadata.planId
  ├─> If planId exists → createPlanSubscriptionFromCheckout()
  └─> Else → old handleCheckoutCompleted()

customer.subscription.updated
  ├─> Check if PlanSubscription exists
  ├─> If yes → syncPlanSubscription()
  └─> Also check old Subscription → handleSubscriptionUpdate()
```

---

## 🧪 Testing Strategy

### 1. Stripe CLI Testing
```bash
# Forward webhooks to local development
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### 2. Real Checkout Testing
1. Create a plan with Stripe integration
2. Complete checkout with test card (4242 4242 4242 4242)
3. Verify PlanSubscription created in database
4. Verify member portal shows subscription
5. Test status changes (pause, resume, cancel)

### 3. Email Testing
1. Check email delivery for welcome
2. Check email delivery for payment failed
3. Check email delivery for cancellation

---

## 📝 Key Decisions

### Backward Compatibility
- **Keep both old and new handlers running in parallel**
- Old `Subscription` model still works for existing customers
- New `PlanSubscription` model for new checkouts
- Gradual migration path

### Metadata Convention
- `checkout.session.metadata.planId` → Use new flow
- No `planId` in metadata → Use old flow
- This allows coexistence

### Error Handling
- Log all webhook errors to `webhookEvent` table
- Don't fail webhook on individual handler errors
- Retry failed webhooks via Stripe dashboard

---

## ⚠️ Edge Cases

### 1. Duplicate Webhooks
- ✅ Already handled: `stripeSubscriptionId` is unique
- ✅ Upsert operations are idempotent

### 2. Missing Plan
- ❌ Error if `planId` not found
- ✅ Log error, don't create subscription

### 3. Missing Consumer
- ✅ Create consumer automatically from checkout email

### 4. Account ID Mismatch
- ✅ Verify business.stripeAccountId matches webhook account

---

## 🚀 Success Criteria

Phase 5 is complete when:
- ✅ Consumer completes checkout → PlanSubscription created
- ✅ Subscription status changes → Database syncs
- ✅ Subscription canceled → Database updated
- ✅ Emails sent for key lifecycle events
- ✅ Member portal shows real subscription data
- ✅ Old model subscriptions still work (backward compatible)
- ✅ All tests pass
- ✅ Deployed to production

---

## 📚 Resources

- [Stripe Webhook Events](https://stripe.com/docs/api/events/types)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
- [Existing webhook-handlers.ts](packages/lib/webhook-handlers.ts)
- [Current webhook route](apps/web/src/app/api/stripe/webhook/route.ts)

