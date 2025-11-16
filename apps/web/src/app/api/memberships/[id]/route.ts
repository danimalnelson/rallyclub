import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import {
  withMiddleware,
  requireBusinessAuth,
  ApiErrors,
} from "@wine-club/lib";

export const GET = withMiddleware(async (req: NextRequest) => {
  try {
    // Extract membership ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // /api/memberships/[id]

    // Fetch membership
    const membership = await prisma.membership.findUnique({
      where: { id },
      include: {
        plans: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        _count: {
          select: {
            plans: true,
          },
        },
      },
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

    return NextResponse.json(membership);
  } catch (error) {
    console.error("Error fetching membership:", error);
    return ApiErrors.internalError("Failed to fetch membership");
  }
});

export const PUT = withMiddleware(async (req: NextRequest) => {
  try {
    // Extract membership ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // /api/memberships/[id]
    const body = await req.json();
    const { businessId, ...membershipData } = body;

    // Fetch existing membership
    const existingMembership = await prisma.membership.findUnique({
      where: { id },
    });

    if (!existingMembership) {
      return ApiErrors.notFound("Membership not found");
    }

    // Authenticate and authorize
    const authResult = await requireBusinessAuth(
      authOptions,
      prisma,
      existingMembership.businessId
    );

    if ("error" in authResult) {
      return authResult.error;
    }

    // Validate cohort billing day if NEXT_INTERVAL
    if (
      membershipData.billingAnchor === "NEXT_INTERVAL" &&
      (!membershipData.cohortBillingDay ||
        membershipData.cohortBillingDay < 1 ||
        membershipData.cohortBillingDay > 31)
    ) {
      return ApiErrors.badRequest(
        "Cohort billing day must be between 1 and 31"
      );
    }

    // Check if billing settings are changing
    const billingSettingsChanging =
      (membershipData.billingAnchor !== undefined &&
        membershipData.billingAnchor !== existingMembership.billingAnchor) ||
      (membershipData.chargeImmediately !== undefined &&
        membershipData.chargeImmediately !== existingMembership.chargeImmediately) ||
      (membershipData.cohortBillingDay !== undefined &&
        membershipData.cohortBillingDay !== existingMembership.cohortBillingDay);

    if (billingSettingsChanging) {
      console.log("[Membership Update] Billing settings changing, checking for active subscriptions");

      // Check for active subscriptions across all plans in this membership
      // Note: Status values are lowercase to match Stripe's format
      const activeSubscriptionCount = await prisma.planSubscription.count({
        where: {
          plan: {
            membershipId: id,
          },
          status: {
            in: ["active", "trialing", "paused"],
          },
        },
      });

      if (activeSubscriptionCount > 0) {
        console.log(
          `[Membership Update] Cannot change billing settings: ${activeSubscriptionCount} active subscription(s) exist`
        );
        return NextResponse.json(
          {
            error: "Cannot change billing settings while active subscriptions exist",
            details: `Found ${activeSubscriptionCount} active subscription(s). These subscriptions must be cancelled or expired before changing billing settings.`,
            code: "ACTIVE_SUBSCRIPTIONS_EXIST",
            activeSubscriptionCount,
          },
          { status: 400 }
        );
      }
    }

    // Update membership (slug is immutable, so exclude it)
    const { slug, ...updateData } = membershipData;

    const membership = await prisma.membership.update({
      where: { id },
      data: {
        name: updateData.name,
        description: updateData.description,
        billingInterval: updateData.billingInterval,
        billingAnchor: updateData.billingAnchor,
        cohortBillingDay: updateData.cohortBillingDay,
        chargeImmediately: updateData.chargeImmediately,
        allowMultiplePlans: updateData.allowMultiplePlans,
        maxMembers: updateData.maxMembers,
        status: updateData.status,
        giftEnabled: updateData.giftEnabled,
        waitlistEnabled: updateData.waitlistEnabled,
        membersOnlyAccess: updateData.membersOnlyAccess,
        pauseEnabled: updateData.pauseEnabled,
        skipEnabled: updateData.skipEnabled,
        benefits: updateData.benefits,
        displayOrder: updateData.displayOrder,
      },
    });

    return NextResponse.json(membership);
  } catch (error) {
    console.error("Error updating membership:", error);
    return ApiErrors.internalError("Failed to update membership");
  }
});

export const DELETE = withMiddleware(async (req: NextRequest) => {
  try {
    // Extract membership ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 1]; // /api/memberships/[id]

    // Fetch existing membership
    const existingMembership = await prisma.membership.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            plans: true,
          },
        },
      },
    });

    if (!existingMembership) {
      return ApiErrors.notFound("Membership not found");
    }

    // Authenticate and authorize
    const authResult = await requireBusinessAuth(
      authOptions,
      prisma,
      existingMembership.businessId
    );

    if ("error" in authResult) {
      return authResult.error;
    }

    // Prevent deletion if membership has plans
    if (existingMembership._count.plans > 0) {
      return ApiErrors.badRequest(
        "Cannot delete membership with active plans. Archive plans first."
      );
    }

    // Delete membership
    await prisma.membership.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting membership:", error);
    return ApiErrors.internalError("Failed to delete membership");
  }
});

