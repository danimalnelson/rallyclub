import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { CACHE_TTL, requireBusinessAuth } from "@wine-club/lib";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();

export async function GET(
  _req: Request,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;

  // Check auth and business access in one call
  const auth = await requireBusinessAuth(authOptions, prisma, businessId);
  if ("error" in auth) return auth.error;

  const { session, business } = auth;

  // Check cache
  const cacheKey = `business:${businessId}:${session.user.id}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL.SHORT) {
    return NextResponse.json(cached.data);
  }

  // Update cache
  cache.set(cacheKey, {
    data: business,
    timestamp: Date.now(),
  });

  return NextResponse.json(business);
}

