import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import {
  withMiddleware,
  requireBusinessAuth,
  ApiErrors,
} from "@wine-club/lib";

export const POST = withMiddleware(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { businessId, ...membershipData } = body;

    // Validate required fields
    if (!businessId || !membershipData.name || !membershipData.slug) {
      return ApiErrors.badRequest("Missing required fields");
    }

    // Authenticate and authorize
    const authResult = await requireBusinessAuth(
      authOptions,
      prisma,
      businessId
    );

    if ("error" in authResult) {
      return authResult.error;
    }

    // Check if slug is already taken
    const existingMembership = await prisma.membership.findFirst({
      where: {
        businessId,
        slug: membershipData.slug,
      },
    });

    if (existingMembership) {
      return ApiErrors.conflict(
        "A membership with this slug already exists"
      );
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

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        businessId,
        name: membershipData.name,
        description: membershipData.description,
        slug: membershipData.slug,
        billingAnchor: membershipData.billingAnchor || "IMMEDIATE",
        cohortBillingDay: membershipData.cohortBillingDay,
        chargeImmediately: membershipData.chargeImmediately ?? true,
        allowMultiplePlans: membershipData.allowMultiplePlans || false,
        maxMembers: membershipData.maxMembers,
        status: membershipData.status || "DRAFT",
        giftEnabled: membershipData.giftEnabled ?? true,
        waitlistEnabled: membershipData.waitlistEnabled || false,
        membersOnlyAccess: membershipData.membersOnlyAccess || false,
        pauseEnabled: membershipData.pauseEnabled || false,
        skipEnabled: membershipData.skipEnabled || false,
        benefits: membershipData.benefits,
        displayOrder: membershipData.displayOrder || 0,
      },
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    console.error("Error creating membership:", error);
    return ApiErrors.internalError("Failed to create membership");
  }
});

