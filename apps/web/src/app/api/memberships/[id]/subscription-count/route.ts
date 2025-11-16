import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";
import { withMiddleware, requireBusinessAuth } from "@wine-club/lib";
import { authOptions } from "@/lib/auth";
import { ApiErrors } from "@wine-club/lib";

/**
 * GET: Count active subscriptions for a membership
 * Used to determine if billing settings can be changed
 */
export const GET = withMiddleware(async (req: NextRequest) => {
  try {
    // Extract membership ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2]; // /api/memberships/[id]/subscription-count

    // Fetch membership to get businessId for auth
    const membership = await prisma.membership.findUnique({
      where: { id },
      select: { businessId: true },
    });

    if (!membership) {
      return ApiErrors.notFound("Membership not found");
    }

    // Authenticate and authorize
    const authResult = await requireBusinessAuth(
      authOptions,
      prisma,
      membership.businessId
    );

    if ("error" in authResult) {
      return authResult.error;
    }

    // Count active subscriptions across all plans in this membership
    // Note: Status values are lowercase to match Stripe's format
    const activeCount = await prisma.planSubscription.count({
      where: {
        plan: {
          membershipId: id,
        },
        status: {
          in: ["active", "trialing", "paused"],
        },
      },
    });

    return NextResponse.json({
      count: activeCount,
      hasActiveSubscriptions: activeCount > 0,
    });
  } catch (error) {
    console.error("Error counting subscriptions:", error);
    return ApiErrors.internalError("Failed to count subscriptions");
  }
});

