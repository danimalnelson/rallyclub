# Wine Club SaaS

A lean, production-ready B2B2C SaaS platform that enables businesses (e.g., wine bars) to create and sell wine club memberships.

## Features

- **B2B Dashboard**: Create/manage membership plans, members, view transactions, handle staff roles
- **B2C Consumer Pages**: Hosted pages for each business + member portal
- **Embeddable Widget**: Drop-in `<script>` tag for any website
- **Stripe Integration**: Connect + Billing + Tax, webhooks, application fees
- **Multi-tenant**: Secure tenant isolation with role-based access control
- **Type-safe**: End-to-end TypeScript with Zod validation

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript + React 18
- **Auth**: NextAuth.js with email + OAuth
- **Database**: PostgreSQL + Prisma ORM
- **Payments**: Stripe (Connect + Billing + Tax)
- **Styling**: TailwindCSS + shadcn/ui
- **Monorepo**: pnpm workspaces

## Project Structure

```
apps/
  web/              # Main Next.js app (B2B + B2C)
  embed/            # Embeddable widget script
packages/
  ui/               # Shared UI components
  config/           # Shared configs (ESLint, Tailwind, TypeScript)
  db/               # Prisma schema, migrations, seed
  lib/              # Shared utilities (Stripe, auth, validation)
  emails/           # Email templates
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL database
- Stripe account

### 1. Clone and Install

```bash
git clone <repo-url>
cd wine-club-saas
pnpm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Database
DATABASE_URL=postgres://user:password@localhost:5432/wineclub

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Email (optional for dev)
RESEND_API_KEY=re_...

# Redis (optional)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Public URLs
PUBLIC_APP_URL=http://localhost:3000
EMBED_PUBLIC_ORIGIN=http://localhost:3000
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed with sample data
pnpm db:seed
```

### 4. Run Development Server

```bash
pnpm dev
```

This starts:
- Next.js app on http://localhost:3000
- Embed widget builder (builds to `/apps/web/public/embed/widget.js`)

### 5. Stripe Webhook Forwarding (for local dev)

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret to your `.env` file as `STRIPE_WEBHOOK_SECRET`.

## Usage Guide

### Creating a Business

1. Sign in at http://localhost:3000/auth/signin
2. Go to the dashboard and create a new business
3. Complete Stripe Connect onboarding in Settings

### Creating Membership Plans

1. Navigate to Plans in your business dashboard
2. Create a plan with name, description, and benefits
3. Add one or more prices (monthly/yearly)
4. Plans are automatically synced to Stripe

### Public Business Page

Each business has a public page at:
```
http://localhost:3000/{business-slug}
```

Consumers can view plans and join directly.

### Embed Widget

Add this code to any website:

```html
<script 
  src="http://localhost:3000/embed/widget.js" 
  data-business="your-slug"
></script>
<div id="wine-club-widget"></div>
```

The widget creates a "Join Wine Club" button that opens a modal with your plans.

### Member Portal

Members can manage their subscription at:
```
http://localhost:3000/{business-slug}/portal
```

This opens the Stripe Customer Portal where they can:
- Update payment methods
- Change plans
- Cancel subscription

## Seeded Data

After running `pnpm db:seed`, you'll have:

- **Business**: Ruby Tap (`slug: rubytap`)
- **Owner**: owner@rubytap.com
- **Staff**: staff@rubytap.com
- **Plans**: Premium Wine Club ($89/mo), Classic Wine Club ($49/mo)
- **Sample Members**: 3 fake consumers with various statuses

Try visiting: http://localhost:3000/rubytap

## API Routes

### Public APIs

- `POST /api/checkout/{slug}/session` - Create checkout session
- `POST /api/portal/{slug}/link` - Get customer portal link
- `GET /api/embed/{slug}/plans` - Get public plans list

### Business APIs (Auth Required)

- `POST /api/plans/create` - Create membership plan
- `POST /api/plans/{planId}/prices` - Add price to plan
- `POST /api/stripe/connect/account-link` - Create Connect onboarding link
- `GET /api/business/{businessId}` - Get business details

### Webhooks

- `POST /api/stripe/webhook` - Stripe webhook handler

Handles these events:
- `checkout.session.completed`
- `customer.subscription.created/updated/deleted`
- `invoice.paid/payment_failed`

## Database Schema

Key models:

- **User**: Platform users (business owners/staff)
- **Business**: Tenants (wine bars, etc.)
- **BusinessUser**: User-business relationship with roles
- **MembershipPlan**: Subscription plans
- **Price**: Plan pricing (monthly/yearly)
- **Consumer**: End customers (club members)
- **Member**: Consumer-business relationship
- **Subscription**: Active subscriptions
- **Transaction**: Payment records
- **WebhookEvent**: Stripe webhook logs
- **AuditLog**: Business action logs

## Development

### Database Commands

```bash
# Generate Prisma client after schema changes
pnpm db:generate

# Create and apply migrations
pnpm db:migrate

# Push schema without migrations (dev)
pnpm db:push

# Open Prisma Studio
pnpm db:studio

# Re-seed database
pnpm db:seed
```

### Build for Production

```bash
pnpm build
```

### Linting

```bash
pnpm lint
```

## Testing

### Unit Tests (Vitest)

```bash
pnpm test
```

### E2E Tests (Playwright)

```bash
pnpm test:e2e
```

## Deployment

### Vercel (Recommended)

1. Connect your repo to Vercel
2. Set environment variables
3. Deploy

### Database

- Neon (serverless Postgres)
- Supabase
- Render
- Any PostgreSQL provider

### Post-Deployment

1. Set up Stripe webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
2. Update `PUBLIC_APP_URL` and `EMBED_PUBLIC_ORIGIN` env vars
3. Test webhook delivery in Stripe dashboard

## Stripe Setup

### Creating a Connect Account (Test Mode)

1. Go to Stripe Dashboard → Connect → Accounts
2. Click "New account" (or use the onboarding flow in the app)
3. Complete business details
4. Link to a business in your database by setting `stripeAccountId`

### Testing Payments

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Requires action: `4000 0025 0000 3155`
- Declined: `4000 0000 0000 9995`

## Security Notes

- All business routes (`/app/:businessId/*`) require authentication
- Tenant isolation enforced at database and API level
- Webhook signatures verified on all Stripe events
- Price validation on server-side (never trust client input)
- CSRF protection via Next.js built-ins

## TODOs / Future Enhancements

- [ ] Rate limiting on public endpoints (Upstash Redis)
- [ ] Email notifications (Resend integration)
- [ ] Advanced analytics dashboard
- [ ] Multiple locations per business
- [ ] Gift memberships
- [ ] Member referral program
- [ ] Inventory management
- [ ] Custom domain support for business pages

## Support

For issues or questions, please open an issue on GitHub.

## License

MIT

