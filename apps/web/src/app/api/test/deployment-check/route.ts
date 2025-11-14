/**
 * Deployment Health Check Endpoint
 * 
 * This endpoint performs comprehensive checks to verify that all critical
 * services and configurations are working correctly in a deployment.
 * 
 * Used for automated deployment verification before manual testing.
 * 
 * SECURITY: Only enabled when ENABLE_TEST_ENDPOINTS=true
 */

import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";
import { Resend } from "resend";

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
  duration?: number;
}

export const dynamic = "force-dynamic";

export async function GET() {
  // Security: Only allow in test environments
  if (process.env.ENABLE_TEST_ENDPOINTS !== "true") {
    return NextResponse.json(
      { error: "Test endpoints are disabled" },
      { status: 403 }
    );
  }

  const results: CheckResult[] = [];
  const startTime = Date.now();

  // 1. Database Connection Check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    results.push({
      name: "Database Connection",
      status: "pass",
      message: "Successfully connected to database",
      duration: Date.now() - dbStart,
    });
  } catch (error: any) {
    results.push({
      name: "Database Connection",
      status: "fail",
      message: `Failed to connect: ${error.message}`,
    });
  }

  // 2. Database URL Configuration
  if (!process.env.DATABASE_URL) {
    results.push({
      name: "Database URL",
      status: "fail",
      message: "DATABASE_URL environment variable is not set",
    });
  } else if (!process.env.DATABASE_URL.includes("postgres://")) {
    results.push({
      name: "Database URL",
      status: "warning",
      message: "DATABASE_URL format looks unusual",
    });
  } else {
    results.push({
      name: "Database URL",
      status: "pass",
      message: "DATABASE_URL is configured",
    });
  }

  // 3. Stripe Configuration
  const stripeChecks = [
    { key: "STRIPE_SECRET_KEY", pattern: "sk_" },
    { key: "STRIPE_PUBLISHABLE_KEY", pattern: "pk_" },
    { key: "STRIPE_WEBHOOK_SECRET", pattern: "whsec_" },
  ];

  for (const check of stripeChecks) {
    const value = process.env[check.key];
    if (!value) {
      results.push({
        name: `Stripe: ${check.key}`,
        status: "fail",
        message: `${check.key} is not set`,
      });
    } else if (!value.startsWith(check.pattern)) {
      results.push({
        name: `Stripe: ${check.key}`,
        status: "warning",
        message: `${check.key} doesn't match expected pattern (${check.pattern}*)`,
      });
    } else {
      results.push({
        name: `Stripe: ${check.key}`,
        status: "pass",
        message: `${check.key} is configured`,
      });
    }
  }

  // 4. Stripe API Connection
  try {
    const stripeStart = Date.now();
    const stripe = getStripeClient();
    // Simple API call to verify connection
    await stripe.products.list({ limit: 1 });
    results.push({
      name: "Stripe API",
      status: "pass",
      message: "Successfully connected to Stripe API",
      duration: Date.now() - stripeStart,
    });
  } catch (error: any) {
    results.push({
      name: "Stripe API",
      status: "fail",
      message: `Failed to connect: ${error.message}`,
    });
  }

  // 5. NextAuth Configuration
  const nextAuthChecks = [
    { key: "NEXTAUTH_SECRET", minLength: 32 },
    { key: "NEXTAUTH_URL", pattern: "http" },
  ];

  for (const check of nextAuthChecks) {
    const value = process.env[check.key];
    if (!value) {
      results.push({
        name: `NextAuth: ${check.key}`,
        status: "fail",
        message: `${check.key} is not set`,
      });
    } else if (check.minLength && value.length < check.minLength) {
      results.push({
        name: `NextAuth: ${check.key}`,
        status: "warning",
        message: `${check.key} should be at least ${check.minLength} characters`,
      });
    } else if (check.pattern && !value.startsWith(check.pattern)) {
      results.push({
        name: `NextAuth: ${check.key}`,
        status: "warning",
        message: `${check.key} doesn't start with ${check.pattern}`,
      });
    } else {
      results.push({
        name: `NextAuth: ${check.key}`,
        status: "pass",
        message: `${check.key} is configured`,
      });
    }
  }

  // 6. Email Service (Resend)
  if (!process.env.RESEND_API_KEY) {
    results.push({
      name: "Email: RESEND_API_KEY",
      status: "fail",
      message: "RESEND_API_KEY is not set",
    });
  } else if (!process.env.RESEND_API_KEY.startsWith("re_")) {
    results.push({
      name: "Email: RESEND_API_KEY",
      status: "warning",
      message: "RESEND_API_KEY doesn't match expected pattern (re_*)",
    });
  } else {
    results.push({
      name: "Email: RESEND_API_KEY",
      status: "pass",
      message: "RESEND_API_KEY is configured",
    });

    // Try to initialize Resend client
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      // Note: We don't send a test email to avoid spam
      results.push({
        name: "Email: Resend Client",
        status: "pass",
        message: "Resend client initialized successfully",
      });
    } catch (error: any) {
      results.push({
        name: "Email: Resend Client",
        status: "fail",
        message: `Failed to initialize: ${error.message}`,
      });
    }
  }

  // 7. Vercel URL Detection
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    results.push({
      name: "Vercel Environment",
      status: "pass",
      message: `Detected Vercel deployment: ${vercelUrl}`,
    });
  } else {
    results.push({
      name: "Vercel Environment",
      status: "pass",
      message: "Running in local/non-Vercel environment",
    });
  }

  // 8. Node Environment
  results.push({
    name: "Node Environment",
    status: "pass",
    message: `NODE_ENV=${process.env.NODE_ENV || "development"}`,
  });

  // Calculate summary
  const totalDuration = Date.now() - startTime;
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warning").length;

  const overallStatus = failed > 0 ? "fail" : warnings > 0 ? "warning" : "pass";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      duration: totalDuration,
      summary: {
        total: results.length,
        passed,
        failed,
        warnings,
      },
      checks: results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        vercel: !!process.env.VERCEL_URL,
      },
    },
    { status: overallStatus === "fail" ? 500 : 200 }
  );
}

