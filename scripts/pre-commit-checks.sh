#!/usr/bin/env bash
# ===============================================
# pre-commit-checks.sh
# Purpose: Fast checks to run before each commit
# ===============================================

set -e

echo "🔍 Running pre-commit checks..."

# 1. Type check
echo "  → TypeScript type check..."
pnpm --filter web exec tsc --noEmit || {
  echo "❌ TypeScript errors found. Fix them before committing."
  exit 1
}

# 2. Run fast unit tests (skip e2e)
echo "  → Running unit tests..."
pnpm --filter web test --run --silent || {
  echo "❌ Tests failed. Fix them before committing."
  exit 1
}

# 3. Check for route conflicts (our new test!)
echo "  → Checking for route conflicts..."
pnpm --filter web test tests/unit/route-conflicts.test.ts --run --silent || {
  echo "❌ Route conflicts detected. Fix them before committing."
  exit 1
}

echo "✅ Pre-commit checks passed!"


