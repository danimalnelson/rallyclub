#!/bin/bash

# Script to push Prisma schema to production database
# WARNING: This will modify the production database schema!

set -e

echo "🚨 WARNING: This will modify the PRODUCTION database schema!"
echo ""
echo "This script will:"
echo "  1. Drop columns: quantityPerShipment, productType, shippingType, shippingCost, trialPeriodDays, minimumCommitmentMonths"
echo "  2. Add columns: recurringFee, recurringFeeName, shippingFee"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo ""
echo "📦 Pushing schema to production..."
echo ""

# Run db push (will use DATABASE_URL from environment)
pnpm db:push

echo ""
echo "✅ Schema pushed successfully!"
echo ""
echo "Next steps:"
echo "  1. Vercel should automatically redeploy"
echo "  2. If not, trigger a redeploy in Vercel dashboard"
echo "  3. Test plan creation in production"

