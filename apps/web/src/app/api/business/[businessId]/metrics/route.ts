import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import {
  calculateMetrics,
  CACHE_TTL,
  requireBusinessAuth,
  withMiddleware,
  createCache,
  type BusinessMetrics,
} from "@wine-club/lib";

// Simple in-memory cache for metrics
const metricsCache = createCache<BusinessMetrics>();

export const GET = withMiddleware(async (req: NextRequest, context) => {
  const { businessId } = await (
    req as any
  ).params as { businessId: string };

  // Authenticate and authorize
  const authResult = await requireBusinessAuth(
    authOptions,
    prisma,
    businessId
  );

  if ("error" in authResult) {
    return authResult.error;
  }

  const key = `metrics:${businessId}`;

  // Check cache first
  const cached = metricsCache.get(key, CACHE_TTL.MEDIUM);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Compute and cache metrics
  const metrics = await calculateMetrics(prisma, businessId);
  metricsCache.set(key, metrics);

  return NextResponse.json(metrics);
});

