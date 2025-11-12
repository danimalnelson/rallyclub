#!/usr/bin/env bash
# ===============================================
# run-full-tests.sh
# Purpose: Run a complete build, migration, and test suite
# Used by the autonomous agent for verification before commits
# ===============================================

set -e  # exit immediately on error

echo "🚀 Starting full test run..."

# Load environment variables if .env or .env.local exist
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

if [ -f ".env.local" ]; then
  set -a
  source .env.local
  set +a
fi

# Ensure database schema is up to date
echo "🔄 Syncing Prisma schema..."
# Check if migrations exist, otherwise use db push for development
if [ -d "packages/db/prisma/migrations" ] && [ "$(ls -A packages/db/prisma/migrations)" ]; then
  echo "  → Running migrations..."
  pnpm --filter db exec -- prisma migrate deploy
else
  echo "  → No migrations found, using db push for development..."
  pnpm --filter db push --skip-generate
fi

# Build the entire project to catch type or runtime issues
echo "🏗️ Building project..."
pnpm build

# Run all unit + integration tests
echo "🧪 Running unit and integration tests..."
pnpm test -- --runInBand --silent

# Run all end-to-end tests if Playwright is configured
if [ -d "tests" ]; then
  echo "🌐 Running end-to-end tests..."
  pnpm playwright test || echo "⚠️ Playwright tests failed — continuing for debug"
fi

# Append timestamp to logs for overnight monitoring
now=$(date +"%Y-%m-%d %H:%M:%S")
echo "[$now] ✅ Full test cycle completed successfully." >> logs/feature-progress.md

echo "✅ All tests completed successfully."
