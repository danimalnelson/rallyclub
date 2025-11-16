import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");
    const resolved = searchParams.get("resolved");
    const type = searchParams.get("type");

    if (!businessId) {
      return NextResponse.json(
        { error: "businessId is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this business
    const businessUser = await prisma.businessUser.findFirst({
      where: {
        businessId,
        userId: session.user.id,
      },
    });

    if (!businessUser) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Build filter
    const where: any = { businessId };
    
    if (resolved !== null && resolved !== undefined) {
      where.resolved = resolved === "true";
    }
    
    if (type) {
      where.type = type;
    }

    // Fetch alerts
    const alerts = await prisma.businessAlert.findMany({
      where,
      orderBy: [
        { severity: "desc" }, // CRITICAL first
        { createdAt: "desc" },
      ],
      take: 100, // Limit to 100 most recent
    });

    // Count unresolved alerts by type
    const counts = await prisma.businessAlert.groupBy({
      by: ["type"],
      where: {
        businessId,
        resolved: false,
      },
      _count: true,
    });

    const countsByType = counts.reduce((acc, item) => {
      acc[item.type] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      alerts,
      counts: countsByType,
      total: counts.reduce((sum, item) => sum + item._count, 0),
    });
  } catch (error) {
    console.error("Get alerts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

