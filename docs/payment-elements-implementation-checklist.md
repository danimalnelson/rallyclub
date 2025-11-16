# Stripe Payment Elements Implementation Checklist

## ✅ Implementation Status

### Backend API Routes
- [x] `/api/portal/[slug]/stripe-config` - Returns publishable key and account ID
- [x] `/api/checkout/[slug]/[planId]/setup-intent` - Creates SetupIntent with customer
- [x] `/api/checkout/[slug]/[planId]/confirm` - Creates subscription after payment

### Frontend Components
- [x] `CheckoutModal.tsx` - Combined email + payment modal
- [x] `MembershipListing.tsx` - Modal state management
- [x] Email collection before SetupIntent creation
- [x] Stripe Elements integration (PaymentElement + AddressElement)
- [x] Edit email functionality

### Customer Consolidation
- [x] Email collected FIRST, before SetupIntent
- [x] Consumer found/created by email
- [x] Stripe Customer ensured on connected account
- [x] SetupIntent tied to specific Customer
- [x] All subscriptions for same email under one Customer

### Data Flow
```
User clicks "Subscribe"
  → Modal opens (email step)
  → User enters email
  → Find/Create Consumer in DB
  → Ensure Stripe Customer exists
  → Create SetupIntent with customer ID
  → Modal transitions to payment step
  → User enters payment details
  → Stripe validates payment method
  → Call confirm endpoint
  → Create Stripe Subscription
  → Create PlanSubscription in DB
  → Success!
```

---

## 🧪 Manual Testing Guide

### Test 1: Email Collection & Validation

**Steps:**
1. Navigate to `http://localhost:3000/the-ruby-tap`
2. Click "Subscribe" on any plan
3. Modal should open with email input on right side
4. Plan details should be visible on left side

**Expected Results:**
- ✅ Email field is autofocused
- ✅ "Continue to Payment" button is disabled without email
- ✅ Button enables when valid email entered
- ✅ Loading state shows when submitting

**Test with:**
- Valid email: `test@example.com` ✅
- Invalid format: `notanemail` ❌
- Empty field: ` ` ❌

---

### Test 2: Payment Elements Loading

**Steps:**
1. Enter valid email and click "Continue to Payment"
2. Wait for payment form to load

**Expected Results:**
- ✅ Modal transitions to payment step
- ✅ Email is displayed: "Subscribing as: test@example.com"
- ✅ "Edit email" button is visible
- ✅ Stripe PaymentElement loads (card input)
- ✅ Stripe AddressElement loads (billing address)
- ✅ Name input field is visible
- ✅ Terms checkbox is visible

**Console Checks:**
- No errors about missing `clientSecret`
- No errors about Stripe initialization
- Elements render without warnings

---

### Test 3: Edit Email Functionality

**Steps:**
1. After reaching payment step, click "Edit email"
2. Modal should return to email step

**Expected Results:**
- ✅ Payment form disappears
- ✅ Email input reappears with previous email
- ✅ Can enter new email
- ✅ Payment form reloads with new SetupIntent

**Test Flow:**
```
Enter: wrong@email.com
→ Click "Continue"
→ Click "Edit email"
→ Enter: correct@email.com
→ Click "Continue"
→ Payment form loads with correct@email.com
```

---

### Test 4: Stripe Test Cards

**Use Stripe test cards to verify payment processing:**

#### ✅ Successful Payment
```
Card: 4242 4242 4242 4242
Exp: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Expected:**
- Payment processes successfully
- Subscription created in Stripe
- Redirects to success page

#### ❌ Card Declined
```
Card: 4000 0000 0000 0002
```

**Expected:**
- Error message displayed
- No subscription created
- User can retry with different card

#### 🔐 3D Secure Authentication
```
Card: 4000 0025 0000 3155
```

**Expected:**
- Stripe opens 3D Secure modal
- User can complete/fail authentication
- Subscription created only if authenticated

---

### Test 5: Customer Consolidation

**Steps:**
1. Complete checkout with `test@example.com`
2. Go back to landing page
3. Subscribe to ANOTHER plan with same email `test@example.com`

**Expected Results:**
- ✅ Both subscriptions in Stripe under ONE customer
- ✅ Check: Stripe Dashboard → Customers → Search `test@example.com`
- ✅ Should see ONE customer with TWO subscriptions

**Verify in Stripe:**
```
Dashboard → Connect → [Your Test Business] → Customers
Search: test@example.com
Expected: 1 customer, multiple subscriptions
```

---

### Test 6: Database Consistency

**After successful checkout, verify:**

**Check `Consumer` table:**
```sql
SELECT * FROM consumers WHERE email = 'test@example.com';
```
- ✅ One Consumer record
- ✅ Has `name` field populated
- ✅ No `stripeCustomerId` (this field doesn't exist)

**Check `PlanSubscription` table:**
```sql
SELECT * FROM plan_subscriptions 
WHERE consumer_id = (SELECT id FROM consumers WHERE email = 'test@example.com');
```
- ✅ One record per subscription
- ✅ Has `stripeCustomerId` field
- ✅ Has `stripeSubscriptionId` field
- ✅ Status is `ACTIVE` or `TRIALING`

---

### Test 7: Error Handling

**Test network failures:**
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Try to continue past email step

**Expected:**
- ✅ Error message displays
- ✅ User can retry
- ✅ No infinite loading states

**Test Stripe errors:**
1. Enter invalid card: `4000 0000 0000 9995`
2. Complete form and submit

**Expected:**
- ✅ Stripe error message appears
- ✅ User can fix and retry
- ✅ Form doesn't break

---

### Test 8: Responsive Design

**Test on different screen sizes:**
- Desktop (1920x1080) ✅
- Laptop (1366x768) ✅
- Tablet (768x1024) ✅
- Mobile (375x667) ✅

**Check:**
- Two-column layout on desktop/tablet
- Single-column on mobile
- Modal doesn't overflow viewport
- Scrollable if content is tall

---

## 🔍 Things to Check in Browser DevTools

### Console
```bash
# Should NOT see:
❌ "Stripe publishable key is undefined"
❌ "clientSecret is required"
❌ "Cannot read property 'X' of undefined"

# Should see (when loading):
✅ Fetching Stripe config...
✅ Creating SetupIntent...
✅ Stripe Elements initialized
```

### Network Tab
```bash
# When entering email:
POST /api/portal/[slug]/stripe-config
  → 200 OK
  → Returns: { publishableKey, stripeAccount }

POST /api/checkout/[slug]/[planId]/setup-intent
  → 200 OK
  → Returns: { clientSecret }

# When completing payment:
POST /api/checkout/[slug]/[planId]/confirm
  → 200 OK
  → Returns: { success: true, subscriptionId }
```

### Application Tab (Cookies)
```bash
# After successful checkout:
✅ NextAuth session cookie present
✅ No sensitive data in localStorage
```

---

## 🚀 Production Readiness Checklist

- [ ] Test with real connected Stripe account (not test mode)
- [ ] Verify webhooks are handling `setup_intent.succeeded`
- [ ] Confirm email verification flow works
- [ ] Test with international cards (non-US)
- [ ] Verify tax calculation (if applicable)
- [ ] Check proration logic for mid-cycle subscriptions
- [ ] Ensure error tracking (Sentry/similar) captures Stripe errors
- [ ] Verify PCI compliance (SAQ A - using Stripe Elements)
- [ ] Test subscription limits (max subscriptions per customer)
- [ ] Confirm refund/cancellation flows work

---

## 📊 Metrics to Monitor

Once deployed, track:
- **Checkout Abandonment Rate**: % who start but don't complete
- **Payment Success Rate**: % of attempts that succeed
- **Customer Consolidation**: Duplicate customer ratio
- **Average Time to Complete**: Seconds from email → success
- **Error Rates**: Payment failures by error type

---

## 🐛 Known Issues / TODO

- [ ] Add loading spinner when Stripe Elements are initializing
- [ ] Add analytics tracking for funnel steps
- [ ] Improve error messages (map Stripe codes to user-friendly text)
- [ ] Add "Back" button on payment step (not just "Edit email")
- [ ] Consider saving partial form data in localStorage
- [ ] Add postal code validation before Stripe submission
- [ ] Implement retry logic for transient network errors

---

## 📝 Testing Commands

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test checkout

# Run E2E tests (requires local server)
pnpm test:e2e

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

---

## ✨ Success Criteria

**The implementation is working correctly if:**

1. ✅ User can complete checkout without page redirects
2. ✅ Email is collected BEFORE payment method
3. ✅ Multiple subscriptions for same email = ONE Stripe customer
4. ✅ Payment Elements load and accept test cards
5. ✅ Errors are handled gracefully
6. ✅ Data syncs correctly between Stripe and database
7. ✅ User can edit email before payment
8. ✅ Modal is responsive on all devices

**Last Updated:** 2025-11-16
**Implementation Status:** ✅ Complete - Ready for Manual Testing

