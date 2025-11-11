import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { calculateMetrics } from "@wine-club/lib";

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { businessId } = await params;

    // Verify user has access to business
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check cache
    const cacheKey = `metrics:${businessId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Calculate metrics
    const metrics = await calculateMetrics(prisma, businessId);

    // Update cache
    cache.set(cacheKey, {
      data: metrics,
      timestamp: Date.now(),
    });

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error("Metrics calculation error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to calculate metrics" },
      { status: 500 }
    );
  }
}

