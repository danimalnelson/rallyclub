# Deployment Guide

Complete guide for deploying Vintigo to production (Vercel + Neon/Render PostgreSQL).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Database Setup](#database-setup)
- [Vercel Deployment](#vercel-deployment)
- [Environment Variables](#environment-variables)
- [Post-Deployment](#post-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Scaling Considerations](#scaling-considerations)
- [Rollback Procedure](#rollback-procedure)

---

## Architecture Overview

### Production Stack

```
┌─────────────┐
│   Vercel    │  ← Next.js app (apps/web)
│  (Hosting)  │
└──────┬──────┘
       │
       ├──────┐
       │      │
       ▼      ▼
   ┌────┐  ┌──────┐
   │Neon│  │Resend│
   │ DB │  │Email │
   └────┘  └──────┘
       │
       ▼
   ┌─────────┐
   │ Stripe  │
   │ Connect │
   └─────────┘
```

### Infrastructure Components

1. **Vercel**: Next.js hosting (apps/web)
2. **Neon or Render**: PostgreSQL database
3. **Stripe**: Payment processing
4. **Resend**: Transactional emails
5. **Upstash** (optional): Redis for rate limiting

---

## Prerequisites

### Accounts Required

- [x] Vercel account (free tier OK for staging)
- [x] Stripe account (live mode enabled)
- [x] Resend account (free tier: 100 emails/day)
- [x] Neon account (free tier: 1 project) OR Render (free tier limited)
- [ ] Domain name (optional, Vercel provides subdomain)

### Tools

```bash
# Install Vercel CLI
npm install -g vercel

# Install pnpm (if not already)
npm install -g pnpm
```

---

## Database Setup

### Option A: Neon (Recommended)

**Pros**: Serverless, auto-scaling, generous free tier, fast provisioning

**Steps**:

1. **Create Account**: https://neon.tech
2. **Create Project**:
   - Name: `vintigo-production`
   - Region: Choose closest to your users (e.g., US East, EU West)
   - PostgreSQL version: 15 or later
3. **Get Connection String**:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. **Copy to `.env.production`**:
   ```bash
   DATABASE_URL="postgresql://..."
   ```

### Option B: Render

**Pros**: Simple setup, free tier available

**Steps**:

1. **Create Account**: https://render.com
2. **Create PostgreSQL Database**:
   - Name: `vintigo-production`
   - Region: Choose closest to users
   - Plan: Starter ($7/month) or Free (limited)
3. **Get Internal Connection String**:
   ```
   postgres://user:password@dpg-xxx.render.com/dbname
   ```
4. **Copy to `.env.production`**:
   ```bash
   DATABASE_URL="postgres://..."
   ```

### Run Migrations

```bash
# From project root
cd packages/db

# Generate Prisma Client
pnpm db:generate

# Push schema to production database
pnpm db:push
# OR run migrations
pnpm prisma migrate deploy

# Seed database (optional, for demo data)
pnpm db:seed
```

**⚠️ Warning**: `db:push` will overwrite schema without migrations. Use `migrate deploy` for production.

---

## Vercel Deployment

### 1. Prepare Repository

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
gh repo create vintigo --private
git remote add origin https://github.com/your-username/vintigo.git
git push -u origin main
```

### 2. Import to Vercel

**Option A: Via Web Dashboard**

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. **Framework Preset**: Next.js
4. **Root Directory**: `apps/web`
5. **Build Command**: `cd ../.. && pnpm install && cd apps/web && pnpm build`
6. **Output Directory**: `.next` (default)
7. **Install Command**: `pnpm install`

**Option B: Via CLI**

```bash
cd apps/web
vercel

# Follow prompts:
# Set up and deploy? Yes
# Which scope? Your account
# Link to existing project? No
# Project name? vintigo
# Directory? ./
# Override settings? Yes
#   - Build Command: pnpm build
#   - Output Directory: .next
#   - Install Command: pnpm install --shamefully-hoist
```

### 3. Configure Build Settings

**Vercel Dashboard → Project Settings → General**

```
Root Directory: apps/web
Framework Preset: Next.js
Build Command: pnpm build
Output Directory: .next
Install Command: pnpm install --shamefully-hoist
Node Version: 18.x
```

**Important**: Add `--shamefully-hoist` for monorepo compatibility.

### 4. Configure Environment Variables

**Vercel Dashboard → Project Settings → Environment Variables**

Add all production variables (see [Environment Variables](#environment-variables) section).

**Tip**: Use Vercel's **Preview** and **Production** environments to separate staging and prod.

---

## Environment Variables

### Production Environment

Create these in **Vercel Dashboard → Environment Variables**:

```bash
# === DATABASE ===
DATABASE_URL="postgresql://user:password@host/dbname"

# === NEXTAUTH ===
NEXTAUTH_URL="https://vintigo.com"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# === STRIPE (LIVE MODE) ===
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_CONNECT_CLIENT_ID="ca_..."

# === RESEND ===
RESEND_API_KEY="re_..."

# === UPSTASH (Optional) ===
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# === PUBLIC URLs ===
PUBLIC_APP_URL="https://vintigo.com"
EMBED_PUBLIC_ORIGIN="https://vintigo.com"
```

### Generate Secrets

```bash
# NEXTAUTH_SECRET
openssl rand -base64 32

# Or use
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Vercel Environment Tips

- **Production**: Used for `main` branch deployments
- **Preview**: Used for all other branches
- **Development**: Used locally (not deployed)

**Recommendation**: Use separate Stripe accounts for Preview and Production.

---

## Post-Deployment

### 1. Configure Stripe Webhooks

**Stripe Dashboard → Developers → Webhooks → Add endpoint**

**URL**: `https://vintigo.com/api/stripe/webhook`

**Events**:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`
- `payment_method.attached`

**Copy Webhook Secret** → Add to Vercel env vars as `STRIPE_WEBHOOK_SECRET`.

### 2. Test Deployment

#### Health Check

```bash
curl https://vintigo.com/api/health
# Expected: {"status": "ok"}
```

(Create this endpoint if it doesn't exist)

#### Test Checkout Flow

1. Visit `https://vintigo.com/{business-slug}`
2. Click "Join Club"
3. Complete test checkout (use test card in live mode preview first)
4. Verify webhook received
5. Check email received

### 3. Configure Custom Domain (Optional)

**Vercel Dashboard → Project Settings → Domains**

1. Add domain: `vintigo.com`
2. Add DNS records (Vercel provides instructions)
3. Wait for SSL certificate (automatic)
4. Update `NEXTAUTH_URL` and `PUBLIC_APP_URL` to use custom domain

**DNS Configuration** (example):
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 4. Verify Email Sending

Send a test email:
```bash
curl -X POST https://vintigo.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com"}'
```

(Create this test endpoint, or trigger via magic link flow)

### 5. Monitor First Transactions

- Check Stripe Dashboard for first payments
- Verify webhook deliveries
- Confirm database records created
- Test Customer Portal access

---

## Monitoring & Maintenance

### Vercel Analytics

**Built-in**: Automatic for all Vercel projects

View at: **Vercel Dashboard → Analytics**

Metrics:
- Page views
- Unique visitors
- Top pages
- Referrers

### Error Tracking (Recommended)

**Sentry** (or similar):

```bash
npm install @sentry/nextjs
```

Configure in `next.config.js`:
```javascript
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  nextConfig,
  { silent: true },
  { hideSourceMaps: true }
);
```

### Database Monitoring

**Neon Dashboard**:
- Query performance
- Connection count
- Storage usage

**Alerts**: Set up email alerts for:
- High CPU usage
- Connection limit reached
- Storage >80% full

### Webhook Monitoring

**Stripe Dashboard → Webhooks → [Your Endpoint]**

Monitor:
- Delivery success rate (should be >99%)
- Response time (should be <5s)
- Failed deliveries (investigate immediately)

**Set Up Alerts**:
```bash
# Check webhook health daily
curl https://dashboard.stripe.com/webhooks/<endpoint_id>/logs
```

### Logging

**Vercel Logs**: **Vercel Dashboard → Deployments → [Deployment] → Logs**

**Structured Logging** (recommended):
```typescript
// Use console.log with structured format
console.log(JSON.stringify({
  level: 'error',
  message: 'Payment failed',
  userId: user.id,
  error: error.message,
  timestamp: new Date().toISOString(),
}));
```

Filter logs in Vercel by searching for keywords.

---

## Scaling Considerations

### Traffic Expectations

**Vercel Free Tier**:
- 100GB bandwidth/month
- 100 serverless function executions/hour
- 10s max function execution

**Vercel Pro** ($20/month):
- 1TB bandwidth
- Unlimited executions
- 60s max execution

### Database Scaling

**Neon**:
- **Free**: 0.5GB storage, 1 project
- **Pro** ($19/month): 10GB, autoscaling, backups
- **Scale**: Custom pricing for high traffic

**Connection Pooling** (recommended for >100 concurrent users):

Use **Prisma Data Proxy** or **PgBouncer**:
```bash
DATABASE_URL="postgresql://user:password@host/dbname?pgbouncer=true"
```

### Caching Strategy

**Upstash Redis** (optional):
```typescript
// Cache expensive queries
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Cache business data for 1 hour
const cachedBusiness = await redis.get(`business:${slug}`);
if (cachedBusiness) return cachedBusiness;

const business = await prisma.business.findUnique({ where: { slug } });
await redis.setex(`business:${slug}`, 3600, JSON.stringify(business));
```

### Rate Limiting

Use Upstash Redis for distributed rate limiting:

```typescript
import { Ratelimit } from '@upstash/ratelimit';

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

const { success } = await ratelimit.limit(ip);
if (!success) {
  return new Response('Too many requests', { status: 429 });
}
```

---

## Rollback Procedure

### Instant Rollback (Vercel)

**Vercel Dashboard → Deployments → [Previous Deployment] → Promote to Production**

Rollback is instant (< 1 minute).

### Database Rollback

**⚠️ Complex**: Database migrations can't be easily rolled back.

**Prevention**:
1. Always test migrations in staging first
2. Backup database before major changes
3. Use Prisma migrations (not `db:push`) in production

**Restore from Backup** (Neon):
1. **Neon Dashboard → Backups**
2. Select backup point
3. Restore to new database
4. Update `DATABASE_URL` in Vercel
5. Redeploy

**Downtime**: 5-15 minutes depending on database size.

---

## CI/CD Pipeline (Optional)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
      
      - name: Build
        run: cd apps/web && pnpm build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

**Setup**:
1. Get Vercel token: **Vercel Dashboard → Settings → Tokens**
2. Add to **GitHub Repo → Settings → Secrets**:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID` (from Vercel project settings)
   - `VERCEL_PROJECT_ID` (from Vercel project settings)

---

## Production Checklist

### Pre-Launch

- [ ] All tests passing (`pnpm test`)
- [ ] Build successful (`pnpm build`)
- [ ] Database migrated to production
- [ ] All environment variables set in Vercel
- [ ] Stripe live mode enabled
- [ ] Webhook endpoint configured
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Email sending tested
- [ ] Test checkout flow with small amount
- [ ] Customer Portal tested
- [ ] Subscription cancellation tested
- [ ] Refund flow tested

### Post-Launch

- [ ] Monitor Vercel logs for errors
- [ ] Check Stripe webhook deliveries
- [ ] Verify first transactions complete successfully
- [ ] Test email notifications received
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure database backups
- [ ] Document rollback procedure
- [ ] Set up alerts for critical errors

### Security

- [ ] NEXTAUTH_SECRET is strong and unique
- [ ] Database credentials are secure
- [ ] Stripe webhook secret is configured
- [ ] No sensitive data in client-side code
- [ ] HTTPS enforced (Vercel does this automatically)
- [ ] Rate limiting enabled (recommended)
- [ ] CORS configured correctly
- [ ] Input validation on all endpoints

---

## Troubleshooting

### Build Fails on Vercel

**Error**: `Cannot find module '@wine-club/...`

**Solution**: Add `--shamefully-hoist` to install command:
```
pnpm install --shamefully-hoist
```

### Database Connection Fails

**Error**: `Can't reach database server`

**Solution**:
1. Check `DATABASE_URL` is correct
2. Verify database is running
3. Check IP whitelist (Neon: allow all IPs for serverless)
4. Test connection locally:
   ```bash
   psql "postgresql://..."
   ```

### Webhooks Not Received

**Solution**:
1. Check webhook endpoint URL is correct
2. Verify `STRIPE_WEBHOOK_SECRET` matches dashboard
3. Check Vercel function logs for errors
4. Test with Stripe CLI:
   ```bash
   stripe trigger checkout.session.completed
   ```

### Emails Not Sending

**Solution**:
1. Check `RESEND_API_KEY` is set
2. Verify API key is valid (test in Resend dashboard)
3. Check Resend logs for delivery status
4. Ensure sender email is verified

---

## Cost Estimate (Monthly)

### MVP (Low Traffic)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Free | $0 |
| Neon | Free | $0 |
| Resend | Free (100/day) | $0 |
| Stripe | Pay-as-you-go | 2.9% + $0.30/transaction |
| **Total** | | **$0** + transaction fees |

### Production (Growing)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| Neon | Pro | $19 |
| Resend | Pro (50k/month) | $20 |
| Upstash | Pro | $10 |
| Stripe | Pay-as-you-go | 2.9% + $0.30/transaction |
| **Total** | | **~$70/month** + transaction fees |

### Scale (High Traffic)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Enterprise | Custom |
| Neon | Scale | $50+ |
| Resend | Enterprise | $80+ |
| Upstash | Enterprise | $50+ |
| **Total** | | **$200+/month** |

---

## Support

**Vercel**: https://vercel.com/support  
**Neon**: https://neon.tech/docs  
**Stripe**: https://support.stripe.com  
**Resend**: https://resend.com/docs

For platform-specific issues, create an issue in the repository or contact the development team.

