# Quick Start Guide

Get your Wine Club SaaS up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
pnpm install
```

## Step 2: Setup Environment

```bash
cp .env.example .env
```

Minimal required setup for development:

```env
DATABASE_URL=postgres://user:password@localhost:5432/wineclub
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PUBLISHABLE_KEY=pk_test_your_key
PUBLIC_APP_URL=http://localhost:3000
```

## Step 3: Setup Database

```bash
# Generate Prisma client
pnpm db:generate

# Create database schema
pnpm db:push

# Add sample data
pnpm db:seed
```

## Step 4: Start Development Server

```bash
pnpm dev
```

Open http://localhost:3000

## Step 5: Test with Sample Business

The seed script created a sample business called "Ruby Tap" at:

**Public Page**: http://localhost:3000/rubytap

Try these test accounts:
- **Owner**: owner@rubytap.com
- **Staff**: staff@rubytap.com

## What's Next?

### Set Up Stripe Webhooks (for local testing)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook secret to your `.env` file.

### Create Your First Business

1. Go to http://localhost:3000/auth/signin
2. Sign in with email (magic link will be logged in console in dev mode)
3. Create a new business
4. Connect Stripe account in Settings
5. Create membership plans
6. Share your public page!

### Test the Widget

Add this to any HTML page:

```html
<script 
  src="http://localhost:3000/embed/widget.js" 
  data-business="rubytap"
></script>
<div id="wine-club-widget"></div>
```

## Common Issues

### Database Connection Error

Make sure PostgreSQL is running and your `DATABASE_URL` is correct.

### Stripe API Error

Verify your Stripe keys are set correctly in `.env`. Use test mode keys for development.

### NextAuth Error

Generate a new secret:
```bash
openssl rand -base64 32
```

Add it to `.env` as `NEXTAUTH_SECRET`.

## Need Help?

Check the full [README.md](./README.md) for detailed documentation.

