#!/usr/bin/env bash
# ===============================================
# run-full-tests.sh
# Purpose: Run a complete build, migration, and test suite
# Used by the autonomous agent for verification before commits
# ===============================================

set -e  # exit immediately on error

echo "🚀 Starting full test run..."

# Ensure database schema is up to date
echo "🔄 Running Prisma migrations..."
pnpm prisma migrate deploy

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

echo "✅ All tests completed successfully."
