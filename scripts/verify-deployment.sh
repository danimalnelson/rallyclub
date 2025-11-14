#!/bin/bash
#
# Deployment Verification Script
#
# Usage:
#   bash scripts/verify-deployment.sh <deployment-url>
#
# Examples:
#   bash scripts/verify-deployment.sh https://membership-saas-web.vercel.app
#   bash scripts/verify-deployment.sh http://localhost:3000
#
# This script performs automated health checks on a deployment to verify:
# - Basic connectivity
# - Health check endpoint
# - Critical pages don't hang
# - API routes are accessible
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get deployment URL from argument
DEPLOYMENT_URL="${1:-http://localhost:3000}"

echo ""
echo "🔍 Verifying deployment: $DEPLOYMENT_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check HTTP status
check_endpoint() {
  local name="$1"
  local endpoint="$2"
  local expected_status="${3:-200}"
  local timeout="${4:-10}"
  
  echo -n "Checking $name... "
  
  # Use curl with timeout
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$DEPLOYMENT_URL$endpoint" 2>&1)
  
  if [ "$response" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $response, expected $expected_status)"
    return 1
  fi
}

# Function to check if endpoint responds within timeout
check_response_time() {
  local name="$1"
  local endpoint="$2"
  local max_time="${3:-5}"
  
  echo -n "Checking $name response time... "
  
  start_time=$(date +%s)
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$max_time" "$DEPLOYMENT_URL$endpoint" 2>&1)
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  
  if [ $duration -le $max_time ] && [ "$response" != "000" ]; then
    echo -e "${GREEN}✓ PASS${NC} (${duration}s, HTTP $response)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (timeout or error after ${duration}s)"
    return 1
  fi
}

# Track test results
PASSED=0
FAILED=0

# Test 1: Basic connectivity
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Basic Connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if check_endpoint "Home page" "/" 200 10; then
  ((PASSED++))
else
  ((FAILED++))
fi
echo ""

# Test 2: Deployment health check (if available)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: Deployment Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if check_response_time "Health check" "/api/test/deployment-check" 10; then
  ((PASSED++))
  
  # Fetch and display health check results
  echo ""
  echo "Health check details:"
  health_response=$(curl -s "$DEPLOYMENT_URL/api/test/deployment-check")
  echo "$health_response" | grep -o '"status":"[^"]*"' | head -1 || echo "Could not parse status"
  echo "$health_response" | grep -o '"passed":[0-9]*' || echo ""
  echo "$health_response" | grep -o '"failed":[0-9]*' || echo ""
  echo "$health_response" | grep -o '"warnings":[0-9]*' || echo ""
else
  ((FAILED++))
  echo -e "${YELLOW}⚠ WARNING${NC}: Health check endpoint may not be available"
  echo "This is expected if ENABLE_TEST_ENDPOINTS is not set"
fi
echo ""

# Test 3: Authentication pages
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: Authentication Pages"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if check_response_time "Sign in page" "/auth/signin" 10; then
  ((PASSED++))
else
  ((FAILED++))
fi
echo ""

# Test 4: API Routes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: API Routes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# NextAuth session endpoint (401 expected if not authenticated)
if check_endpoint "NextAuth session" "/api/auth/session" 200 10; then
  ((PASSED++))
else
  # 401 is also acceptable for unauthenticated requests
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$DEPLOYMENT_URL/api/auth/session" 2>&1)
  if [ "$response" = "401" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP 401 - expected for unauthenticated)"
    ((PASSED++))
  else
    ((FAILED++))
  fi
fi
echo ""

# Test 5: Static Assets
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: Static Assets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if check_endpoint "Favicon" "/favicon.ico" 200 5; then
  ((PASSED++))
else
  # 404 is acceptable for favicon
  echo -e "${YELLOW}⚠ WARNING${NC}: Favicon not found (acceptable)"
  ((PASSED++))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASSED + FAILED))
echo "Total tests: $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  echo ""
  echo "✅ Deployment is healthy and ready for manual verification"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  echo ""
  echo "❌ Deployment may have issues. Please investigate failed checks."
  exit 1
fi

