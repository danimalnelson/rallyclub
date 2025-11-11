# API Reference

Complete reference for all API endpoints in the Vintigo (Wine Club SaaS) platform.

## Table of Contents

- [Authentication](#authentication)
- [Business Management](#business-management)
- [Membership Plans & Pricing](#membership-plans--pricing)
- [Checkout & Payments](#checkout--payments)
- [Consumer Authentication](#consumer-authentication)
- [Stripe Integration](#stripe-integration)
- [Webhooks](#webhooks)

---

## Authentication

### Business User Authentication

Uses NextAuth.js with Email and OAuth providers.

**Sign In**: `/api/auth/signin`  
**Sign Out**: `/api/auth/signout`  
**Session**: `/api/auth/session`

Session includes:
```typescript
{
  user: {
    id: string;
    email: string;
    name?: string;
    image?: string;
  };
  businessId?: string; // Current active business
}
```

---

## Business Management

### Get Business Details

```
GET /api/business/[businessId]
```

**Authentication**: Required (business user with access)

**Response**:
```json
{
  "id": "business_123",
  "name": "Ruby Tap Wine Bar",
  "slug": "rubytap",
  "logoUrl": "https://...",
  "stripeAccountId": "acct_...",
  "createdAt": "2025-11-01T00:00:00Z"
}
```

**Errors**:
- `401`: Not authenticated
- `403`: No access to this business
- `404`: Business not found

---

### Create Business

```
POST /api/business/create
```

**Authentication**: Required (authenticated user)

**Request Body**:
```json
{
  "name": "Ruby Tap Wine Bar",
  "slug": "rubytap",
  "country": "US",
  "currency": "usd"
}
```

**Validation Rules**:
- `slug`: 3-50 chars, lowercase alphanumeric + hyphens
- `slug`: Must not conflict with reserved routes (api, app, admin, etc.)
- `slug`: Must be globally unique
- `name`: 1-100 characters
- `country`: ISO 3166-1 alpha-2 code
- `currency`: ISO 4217 currency code

**Response**:
```json
{
  "id": "business_123",
  "name": "Ruby Tap Wine Bar",
  "slug": "rubytap",
  "createdAt": "2025-11-01T00:00:00Z"
}
```

**Errors**:
- `400`: Invalid input or slug unavailable
- `401`: Not authenticated
- `409`: Slug already taken

---

## Membership Plans & Pricing

### Create Membership Plan

```
POST /api/plans/create
```

**Authentication**: Required (business user with OWNER or ADMIN role)

**Request Body**:
```json
{
  "businessId": "business_123",
  "name": "Gold Membership",
  "description": "Premium wine club with exclusive selections",
  "benefits": ["Exclusive wines", "10% discount", "Free shipping"]
}
```

**Side Effects**:
- Creates Stripe Product on connected account
- Stores `stripeProductId` in database

**Response**:
```json
{
  "id": "plan_123",
  "businessId": "business_123",
  "name": "Gold Membership",
  "description": "...",
  "benefits": ["..."],
  "stripeProductId": "prod_...",
  "status": "ACTIVE",
  "createdAt": "2025-11-01T00:00:00Z"
}
```

**Errors**:
- `400`: Invalid input
- `401`: Not authenticated
- `403`: No permission to create plans for this business
- `500`: Stripe API error

---

### Add Price to Plan

```
POST /api/plans/[planId]/prices
```

**Authentication**: Required (business user with OWNER or ADMIN role)

**Request Body**:
```json
{
  "nickname": "Monthly Gold",
  "interval": "month",
  "unitAmount": 4999,
  "currency": "usd",
  "trialDays": 7
}
```

**Validation**:
- `interval`: "month" | "year"
- `unitAmount`: Integer (cents)
- `trialDays`: Optional, 0-365

**Side Effects**:
- Creates Stripe Price on connected account
- Links price to Stripe Product
- Stores `stripePriceId` in database

**Response**:
```json
{
  "id": "price_123",
  "membershipPlanId": "plan_123",
  "nickname": "Monthly Gold",
  "interval": "month",
  "unitAmount": 4999,
  "currency": "usd",
  "stripePriceId": "price_...",
  "createdAt": "2025-11-01T00:00:00Z"
}
```

**Errors**:
- `400`: Invalid input
- `401`: Not authenticated
- `403`: No permission
- `404`: Plan not found
- `500`: Stripe API error

---

## Checkout & Payments

### Create Checkout Session

```
POST /api/checkout/[slug]/session
```

**Authentication**: None (public endpoint)

**URL Parameters**:
- `slug`: Business slug

**Request Body**:
```json
{
  "priceId": "price_123",
  "customerEmail": "customer@example.com"
}
```

**Security**:
- ✅ Validates price belongs to the business (prevents cross-tenant price usage)
- ✅ Double-checks price's plan belongs to requested business
- ✅ Logs potential cross-tenant access attempts

**Side Effects**:
- Creates Stripe Checkout Session on connected account
- Creates or retrieves Consumer record
- Sets `client_reference_id` to Consumer ID

**Response**:
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_..."
}
```

**Checkout Session Configuration**:
- Mode: `subscription`
- Success URL: `/{slug}/success?session_id={CHECKOUT_SESSION_ID}`
- Cancel URL: `/{slug}/plans`
- Automatic tax calculation: Enabled
- Application fee: Configured (if enabled)

**Errors**:
- `400`: Invalid price or missing required fields
- `404`: Business or price not found
- `500`: Stripe API error

---

### Get Checkout Success Data

After successful checkout, redirect to:
```
GET /{slug}/success?session_id={CHECKOUT_SESSION_ID}
```

Displays:
- Confirmation message
- Plan details
- Link to member portal

---

## Consumer Authentication

### Send Magic Link

```
POST /api/consumer/auth/magic-link
```

**Authentication**: None (public endpoint)

**Request Body**:
```json
{
  "email": "consumer@example.com",
  "businessSlug": "rubytap",
  "returnUrl": "/rubytap/portal"
}
```

**Side Effects**:
- Creates Consumer record if doesn't exist
- Generates magic token (32-byte hex)
- Sends email with magic link (15-minute expiration)

**Response**:
```json
{
  "success": true
}
```

**Email Content**:
- Subject: "Sign in to {Business Name}"
- Magic link: `/{slug}/auth/verify?token={token}&email={email}&returnUrl={returnUrl}`

**Errors**:
- `400`: Invalid input
- `404`: Business not found
- `500`: Email send failed

---

### Verify Magic Link

```
POST /api/consumer/auth/verify
```

**Authentication**: None (uses token)

**Request Body**:
```json
{
  "token": "abc123...",
  "email": "consumer@example.com",
  "businessSlug": "rubytap"
}
```

**Side Effects**:
- Validates token (MVP: simple email match)
- Creates session cookie (HTTP-only, 7 days)

**Response**:
```json
{
  "success": true
}
```

**Sets Cookie**:
```
consumer_session={base64_encoded_session}
Path=/
HttpOnly
SameSite=Lax
Max-Age=604800 (7 days)
```

**Errors**:
- `400`: Invalid or expired token
- `401`: Verification failed

---

### Check Consumer Session

```
GET /api/consumer/auth/session
```

**Authentication**: Required (consumer session cookie)

**Response**:
```json
{
  "consumerId": "consumer_123",
  "email": "consumer@example.com",
  "name": "John Doe",
  "businessSlug": "rubytap"
}
```

**Errors**:
- `401`: Not authenticated or session expired

---

## Stripe Integration

### Create Connect Account Link

```
POST /api/stripe/connect/account-link
```

**Authentication**: Required (business user with OWNER role)

**Request Body**:
```json
{
  "businessId": "business_123",
  "refreshUrl": "/app/business_123/settings",
  "returnUrl": "/app/business_123/settings"
}
```

**Side Effects**:
- Creates Stripe Connect Express account (if doesn't exist)
- Generates Account Link for onboarding
- Updates `stripeAccountId` in business record

**Response**:
```json
{
  "url": "https://connect.stripe.com/setup/..."
}
```

**Errors**:
- `400`: Invalid input
- `401`: Not authenticated
- `403`: Not owner of business
- `500`: Stripe API error

---

### Open Customer Portal

```
POST /api/portal/[slug]/link
```

**Authentication**: None (requires consumer email)

**URL Parameters**:
- `slug`: Business slug

**Request Body**:
```json
{
  "consumerEmail": "consumer@example.com"
}
```

**Side Effects**:
- Finds consumer by email
- Retrieves Stripe customer ID
- Generates Customer Portal session on connected account

**Response**:
```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

**Portal Configuration**:
- Return URL: `/{slug}/portal`
- Features: Update payment method, cancel subscription, view invoices

**Errors**:
- `400`: Invalid input
- `404`: Consumer or business not found
- `500`: Stripe API error

---

### Get Embed Plans

```
GET /api/embed/[slug]/plans
```

**Authentication**: None (public endpoint)

**URL Parameters**:
- `slug`: Business slug

**Response**:
```json
{
  "business": {
    "name": "Ruby Tap Wine Bar",
    "slug": "rubytap"
  },
  "plans": [
    {
      "id": "plan_123",
      "name": "Gold Membership",
      "description": "...",
      "prices": [
        {
          "id": "price_123",
          "nickname": "Monthly",
          "interval": "month",
          "unitAmount": 4999,
          "currency": "usd"
        }
      ]
    }
  ]
}
```

**Filters**:
- Only returns plans with status `ACTIVE`
- Only includes prices linked to Stripe

**Errors**:
- `404`: Business not found

---

## Webhooks

### Stripe Webhook Handler

```
POST /api/stripe/webhook
```

**Authentication**: Stripe signature verification

**Headers**:
- `Stripe-Signature`: Webhook signature (required)
- `Stripe-Account`: Connected account ID (for Connect events)

**Handled Events**:

#### `checkout.session.completed`
- Creates Consumer, Member, and Subscription records
- Links Stripe customer ID to Consumer
- Sets initial subscription status
- **No email** (sent on first invoice.paid)

#### `customer.subscription.created`
- Creates or updates Subscription record
- Sets Member status based on subscription status

#### `customer.subscription.updated`
- Updates Subscription status and current period end
- Updates Member status accordingly

#### `customer.subscription.deleted`
- Updates Subscription status to "canceled"
- Sets Member status to "CANCELED"
- **Sends cancellation email** with access end date

#### `invoice.paid`
- Creates Transaction record (type: CHARGE)
- **Sends welcome email** on first invoice (`billing_reason: subscription_create`)
- Records payment amount and Stripe IDs

#### `invoice.payment_failed`
- Sets Member status to "PAST_DUE"
- **Sends payment failed email** with portal link to update payment method

#### `charge.refunded`
- Creates Transaction record (type: REFUND)
- **Sends refund confirmation email**

#### `payment_method.attached`
- Updates or creates PaymentMethod record
- Links to Consumer

**Response**:
```json
{
  "received": true
}
```

**Errors**:
- `400`: Invalid signature or payload
- `500`: Webhook processing error

**Webhook Logging**:
All webhook events are stored in `WebhookEvent` table with:
- Event type
- Received timestamp
- Full event body
- Signature validation status
- Connected account ID (if applicable)

---

## Rate Limiting

**Not Implemented** (MVP)

Recommended for production:
- Public endpoints: 100 requests/15 minutes per IP
- Authenticated endpoints: 1000 requests/15 minutes per user
- Magic link: 5 requests/15 minutes per email

Use Upstash Redis for distributed rate limiting.

---

## Error Handling

All API routes return consistent error responses:

```json
{
  "error": "Human-readable error message",
  "details": {} // Optional, for validation errors
}
```

**HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (validation failed)
- `401`: Unauthorized (not authenticated)
- `403`: Forbidden (no permission)
- `404`: Not Found
- `409`: Conflict (e.g., slug already taken)
- `500`: Internal Server Error

---

## Testing

### Unit Tests
Run validation and logic tests:
```bash
cd apps/web
pnpm test
```

### E2E Tests
Run Playwright smoke tests:
```bash
cd apps/web
pnpm test:e2e
```

---

## Security

### Multi-Tenancy Isolation
- All business data queries filtered by `businessId`
- Cross-tenant price validation in checkout
- Tenant-guard utilities for access control
- Audit logging for sensitive operations

### Input Validation
- All inputs validated with Zod schemas
- Slug validation prevents reserved route conflicts
- Email validation on all email inputs
- Currency and country code validation

### Session Security
- Business users: NextAuth.js with secure JWT
- Consumers: HTTP-only session cookies
- SameSite: Lax (CSRF protection)
- 7-day consumer session expiration

### Webhook Security
- Signature verification required
- All events logged for audit trail
- Idempotency by storing `stripeSubscriptionId` as unique key

---

## Pagination

**Not Implemented** (MVP)

For production:
```
GET /api/business/[businessId]/members?page=1&limit=50
```

Use cursor-based pagination for large datasets.

---

## API Versioning

**Not Implemented** (MVP)

For production, consider:
- URL versioning: `/api/v1/...`
- Header versioning: `Accept: application/vnd.vintigo.v1+json`

