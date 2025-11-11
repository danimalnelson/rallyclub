# Stripe Integration Guide

Complete guide for Stripe Connect, Billing, Tax, and payment flows in Vintigo.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Setup & Configuration](#setup--configuration)
- [Stripe Connect](#stripe-connect)
- [Products & Pricing](#products--pricing)
- [Checkout Flow](#checkout-flow)
- [Customer Portal](#customer-portal)
- [Webhooks](#webhooks)
- [Tax Calculation](#tax-calculation)
- [Application Fees](#application-fees)
- [Testing](#testing)
- [Production Checklist](#production-checklist)

---

## Overview

### Payment Model: B2B2C Platform

**Platform (Vintigo)** → **Businesses (Wine Bars)** → **Consumers (Members)**

- Each business has a **Stripe Connect Express account**
- Products and prices are created **on the connected account** (not platform)
- Platform charges **application fees** on each transaction
- Consumers pay directly to the business (funds go to connected account)

### Stripe Products Used

1. **Connect (Express)**: Multi-party payment processing
2. **Billing**: Recurring subscription management
3. **Tax**: Automated sales tax calculation
4. **Checkout**: Hosted payment page
5. **Customer Portal**: Self-service subscription management

---

## Architecture

### Data Flow

```
Consumer → Stripe Checkout (connected account)
         → Subscription created
         → Webhook → Platform DB
         → Email notifications
```

### Account Structure

```
Platform Account (Vintigo)
├─ Stripe Connect Express Account (Business #1)
│  ├─ Products
│  ├─ Prices
│  ├─ Customers
│  └─ Subscriptions
├─ Stripe Connect Express Account (Business #2)
│  └─ ...
```

### Why Products on Connected Accounts?

- **Pro**: Businesses own their product data
- **Pro**: Easier payout reconciliation
- **Pro**: Businesses can access Stripe Dashboard
- **Pro**: Simplifies tax calculation (connected account's location)
- **Con**: Platform can't easily list all products (requires cross-account queries)

---

## Setup & Configuration

### Environment Variables

```bash
# Platform Stripe Account
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Connect
STRIPE_CONNECT_CLIENT_ID=ca_...

# Public URLs
PUBLIC_APP_URL=https://yourdomain.com
```

### Stripe API Version

**Current**: `2023-10-16`

Specified in `packages/lib/stripe.ts`:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
  typescript: true,
});
```

### Getting Stripe Keys

1. **Dashboard**: https://dashboard.stripe.com
2. Navigate to **Developers → API keys**
3. Copy Secret key and Publishable key
4. For webhooks: **Developers → Webhooks → Add endpoint**

---

## Stripe Connect

### Onboarding Flow

**Business Dashboard** → **Settings** → **Connect with Stripe**

#### 1. Create Connect Account

```typescript
// Server Action (simplified)
const account = await stripe.accounts.create({
  type: "express",
  country: business.country,
  email: user.email,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});

// Save to database
await prisma.business.update({
  where: { id: businessId },
  data: { stripeAccountId: account.id },
});
```

#### 2. Generate Account Link

```typescript
const accountLink = await stripe.accountLinks.create({
  account: stripeAccountId,
  refresh_url: `${PUBLIC_APP_URL}/app/${businessId}/settings`,
  return_url: `${PUBLIC_APP_URL}/app/${businessId}/settings`,
  type: "account_onboarding",
});

// Redirect user to accountLink.url
```

**Account Link expires in 5 minutes** - regenerate if needed.

#### 3. Check Onboarding Status

```typescript
const account = await stripe.accounts.retrieve(stripeAccountId);

const isOnboarded = account.charges_enabled && account.payouts_enabled;
```

Display onboarding status in Business Settings:
- ✅ **Complete**: Charges and payouts enabled
- ⏳ **Incomplete**: Show "Complete Onboarding" button
- ❌ **Restricted**: Contact support

---

## Products & Pricing

### Create Product (on Connected Account)

When a business creates a membership plan:

```typescript
import { getStripeClient } from "@wine-club/lib";

const stripe = getStripeClient(business.stripeAccountId);

const product = await stripe.products.create({
  name: "Gold Membership",
  description: "Premium wine club with exclusive selections",
});

// Save to database
await prisma.membershipPlan.update({
  where: { id: planId },
  data: { stripeProductId: product.id },
});
```

### Create Price (on Connected Account)

When adding a price to a plan:

```typescript
const stripe = getStripeClient(business.stripeAccountId);

const price = await stripe.prices.create({
  product: plan.stripeProductId,
  nickname: "Monthly Gold",
  recurring: {
    interval: "month",
    trial_period_days: 7, // Optional
  },
  unit_amount: 4999, // $49.99 in cents
  currency: "usd",
  tax_behavior: "exclusive", // Tax calculated separately
});

// Save to database
await prisma.price.create({
  data: {
    membershipPlanId: planId,
    nickname: "Monthly Gold",
    interval: "month",
    unitAmount: 4999,
    currency: "usd",
    trialDays: 7,
    stripePriceId: price.id,
  },
});
```

### Price Intervals

- `month`: Monthly billing
- `year`: Annual billing

For both, create separate prices and let consumers toggle.

---

## Checkout Flow

### 1. Consumer Clicks "Join Club"

**Page**: `/{slug}/plans/{planId}`

**Action**: Calls `/api/checkout/{slug}/session`

### 2. Create Checkout Session

```typescript
import { getStripeClient } from "@wine-club/lib";

const stripe = getStripeClient(business.stripeAccountId);

// Get or create consumer
const consumer = await getOrCreateConsumer(customerEmail);

// Get or create Stripe customer on connected account
let stripeCustomerId = consumer.stripeCustomerId;
if (!stripeCustomerId) {
  const customer = await stripe.customers.create({
    email: consumer.email,
    name: consumer.name,
  });
  stripeCustomerId = customer.id;
  
  await prisma.consumer.update({
    where: { id: consumer.id },
    data: { stripeCustomerId },
  });
}

// Create checkout session
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: stripeCustomerId,
  line_items: [
    {
      price: price.stripePriceId,
      quantity: 1,
    },
  ],
  success_url: `${PUBLIC_APP_URL}/${business.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${PUBLIC_APP_URL}/${business.slug}/plans`,
  client_reference_id: consumer.id, // Link back to our consumer
  automatic_tax: { enabled: true }, // Stripe Tax
  allow_promotion_codes: true, // Optional
  // Application fee (if enabled)
  subscription_data: {
    application_fee_percent: 10, // Platform takes 10%
    // OR
    // application_fee_amount: 500, // Flat $5 fee
  },
});

return { url: session.url };
```

**Security**: Always fetch price from DB by `priceId` and verify it belongs to the business.

### 3. Redirect to Stripe

```typescript
window.location.href = checkoutUrl;
```

Consumer completes payment on Stripe-hosted page.

### 4. Success Redirect

After payment, Stripe redirects to:
```
/{slug}/success?session_id=cs_test_...
```

Display confirmation and link to member portal.

---

## Customer Portal

Self-service subscription management for consumers.

### Generate Portal Link

```typescript
const stripe = getStripeClient(business.stripeAccountId);

const portalSession = await stripe.billingPortal.sessions.create({
  customer: consumer.stripeCustomerId,
  return_url: `${PUBLIC_APP_URL}/${business.slug}/portal`,
});

return { url: portalSession.url };
```

### Portal Features (Configured in Stripe Dashboard)

- **Update payment method**: ✅ Enabled
- **Cancel subscription**: ✅ Enabled (immediate or at period end)
- **View invoices**: ✅ Enabled
- **Update billing info**: ✅ Enabled

### Configuration

1. Go to **Stripe Dashboard → Settings → Billing → Customer Portal**
2. Enable features
3. Set cancellation policy
4. Customize branding (logo, colors)

**Note**: Portal configuration is per account (applies to all businesses on the connected account).

---

## Webhooks

### Setup Webhook Endpoint

**Stripe Dashboard → Developers → Webhooks → Add endpoint**

**URL**: `https://yourdomain.com/api/stripe/webhook`

**Events to Enable**:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `payment_method.attached`

### Webhook Handler

**File**: `apps/web/src/app/api/stripe/webhook/route.ts`

#### Signature Verification

```typescript
const sig = headers().get("stripe-signature");
const body = await req.text();

const event = stripe.webhooks.constructEvent(
  body,
  sig!,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

**CRITICAL**: Never process webhooks without signature verification.

#### Connect Account Detection

```typescript
const accountId = headers().get("stripe-account") || undefined;
```

If `accountId` is present, the event is from a connected account.

#### Event Handling

##### `checkout.session.completed`
- Get or create Consumer
- Create Member record
- Create Subscription record
- Link Stripe customer ID

##### `invoice.paid`
- Create Transaction record (CHARGE)
- Send welcome email on first invoice
- Update subscription status

##### `invoice.payment_failed`
- Set Member status to PAST_DUE
- Send payment failed email with portal link

##### `customer.subscription.deleted`
- Update Subscription and Member to CANCELED
- Send cancellation confirmation email

##### `charge.refunded`
- Create Transaction record (REFUND)
- Send refund confirmation email

### Testing Webhooks Locally

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/stripe/webhook

# Copy webhook secret to .env.local
# STRIPE_WEBHOOK_SECRET=whsec_...

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
```

### Webhook Logging

All events are logged in `WebhookEvent` table:
```sql
SELECT * FROM "WebhookEvent" ORDER BY receivedAt DESC LIMIT 10;
```

Useful for:
- Debugging webhook issues
- Audit trail
- Replaying failed events

---

## Tax Calculation

**Stripe Tax** automatically calculates sales tax based on:
- Customer location
- Product tax code
- Local tax rules

### Enable Tax in Checkout

```typescript
const session = await stripe.checkout.sessions.create({
  // ...
  automatic_tax: { enabled: true },
});
```

### Tax Configuration

1. Go to **Stripe Dashboard → Products → Tax**
2. Enable Tax
3. Add business tax registration IDs (e.g., VAT, GST)
4. Set product tax codes (default: `txcd_10000000` for physical goods)

### Tax on Subscriptions

Tax is calculated **on each invoice**, not just the first payment.

Handled automatically by Stripe Billing.

---

## Application Fees

Platform revenue model.

### Percentage Fee

```typescript
subscription_data: {
  application_fee_percent: 10, // 10% to platform
}
```

**Example**: $50 subscription → $5 to platform, $45 to business.

### Fixed Fee

```typescript
subscription_data: {
  application_fee_amount: 500, // $5 flat fee
}
```

### Fee Transfer Timeline

- Fees are transferred to platform account automatically
- Transfer schedule: Standard (2 days) or Instant (for additional fee)

### View Fees in Dashboard

**Platform Dashboard → Connect → Application Fees**

---

## Refunds

### Issue Refund

```typescript
const stripe = getStripeClient(business.stripeAccountId);

const refund = await stripe.refunds.create({
  charge: chargeId,
  amount: 4999, // Optional: partial refund
  reason: "requested_by_customer",
});
```

### Refund Webhook

`charge.refunded` event triggers:
1. Create Transaction record (type: REFUND)
2. Send refund confirmation email
3. Update subscription status (if full refund)

### Refund Policy

Configurable in Stripe Customer Portal settings.

---

## Testing

### Test Mode

Use test keys (`sk_test_...`) during development.

**Test Cards**:
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Requires 3D Secure: 4000 0025 0000 3155
```

Expiry: Any future date  
CVC: Any 3 digits  
ZIP: Any 5 digits

### Test Stripe Connect

1. Create test connected account in Dashboard
2. Complete onboarding in test mode
3. Use test account ID in development

### Webhook Testing

See [Testing Webhooks Locally](#testing-webhooks-locally)

---

## Production Checklist

### Before Launch

- [ ] Switch to live keys (`sk_live_...`)
- [ ] Configure live webhook endpoint
- [ ] Enable Stripe Tax in production
- [ ] Set application fee percentage
- [ ] Configure Customer Portal (branding, features)
- [ ] Add business tax registration IDs
- [ ] Set up Connect webhook events
- [ ] Test full checkout flow in live mode (with small amounts)
- [ ] Verify email notifications work
- [ ] Test refund flow
- [ ] Test subscription cancellation
- [ ] Check Customer Portal works correctly

### Compliance

- [ ] Add terms of service link in Checkout
- [ ] Add privacy policy link in Checkout
- [ ] Display Stripe branding as required
- [ ] Comply with PCI DSS (Stripe handles most of this)
- [ ] Comply with SCA (Strong Customer Authentication) in EU

### Monitoring

- [ ] Set up Stripe webhook monitoring
- [ ] Alert on failed webhook deliveries
- [ ] Monitor payment failure rates
- [ ] Track application fee revenue
- [ ] Monitor Connect account onboarding completion rates

### Security

- [ ] Never log full credit card numbers
- [ ] Use HTTPS in production (required by Stripe)
- [ ] Rotate Stripe webhook secrets periodically
- [ ] Limit Stripe API key access (use restricted keys if possible)
- [ ] Monitor for unusual refund patterns

---

## Common Issues & Solutions

### Issue: Webhook signature verification fails

**Solution**:
- Check `STRIPE_WEBHOOK_SECRET` is correct
- Ensure raw body is passed to `constructEvent` (not parsed JSON)
- Verify webhook endpoint URL matches exactly

### Issue: Customer can't complete checkout

**Solution**:
- Verify business has completed Connect onboarding
- Check `charges_enabled` and `payouts_enabled` on account
- Ensure price exists on connected account
- Check for Stripe errors in console logs

### Issue: Tax not calculated

**Solution**:
- Enable Stripe Tax in Dashboard
- Set `automatic_tax: { enabled: true }` in Checkout
- Verify customer address is provided
- Check business tax registration IDs are configured

### Issue: Application fee not applied

**Solution**:
- Ensure `subscription_data.application_fee_percent` is set
- Verify account has `transfers` capability
- Check platform account has necessary permissions

### Issue: Consumer doesn't receive email after payment

**Solution**:
- Check webhook handler processes `invoice.paid` correctly
- Verify `RESEND_API_KEY` is set
- Check email service logs
- Look for webhook processing errors

---

## Resources

- [Stripe API Docs](https://stripe.com/docs/api)
- [Stripe Connect Docs](https://stripe.com/docs/connect)
- [Stripe Billing Docs](https://stripe.com/docs/billing)
- [Stripe Tax Docs](https://stripe.com/docs/tax)
- [Stripe Webhooks Docs](https://stripe.com/docs/webhooks)
- [Stripe Testing Docs](https://stripe.com/docs/testing)

---

## Support

**Stripe Support**: https://support.stripe.com  
**Platform Issues**: Create an issue in the repo or contact the development team.

