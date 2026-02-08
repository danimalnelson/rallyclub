import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { updateBusinessProfileSchema } from "@wine-club/lib";
import { stripe } from "@wine-club/lib";
import { del } from "@vercel/blob";
import { z } from "zod";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { businessId } = await params;
    const body = await req.json();
    const validatedData = updateBusinessProfileSchema.parse(body);

    // Verify user has OWNER or ADMIN access to business
    const business = await prisma.business.findFirst({
      where: {
        id: businessId,
        users: {
          some: {
            userId: session.user.id,
            role: {
              in: ["OWNER", "ADMIN"],
            },
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: "Business not found or insufficient permissions" },
        { status: 404 }
      );
    }

    // Clean up old blob if logoUrl is being cleared or changed
    const oldLogoUrl = business.logoUrl;
    const newLogoUrl = validatedData.logoUrl;
    if (
      oldLogoUrl &&
      oldLogoUrl.includes(".vercel-storage.com") &&
      newLogoUrl !== undefined &&
      newLogoUrl !== oldLogoUrl
    ) {
      try {
        await del(oldLogoUrl);
      } catch {
        // Ignore deletion errors (file may already be gone)
      }
    }

    // Update business profile
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
    });

    // Sync with Stripe Connect account if exists
    if (business.stripeAccountId) {
      try {
        await stripe.accounts.update(business.stripeAccountId, {
          business_profile: {
            name: validatedData.name || business.name,
            url: validatedData.website || business.website || undefined,
            support_email:
              validatedData.contactEmail ||
              business.contactEmail ||
              undefined,
            support_phone:
              validatedData.contactPhone ||
              business.contactPhone ||
              undefined,
          },
          metadata: {
            logoUrl:
              validatedData.logoUrl ||
              business.logoUrl ||
              "",
            description:
              validatedData.description ||
              business.description ||
              "",
            brandColorPrimary:
              validatedData.brandColorPrimary ||
              business.brandColorPrimary ||
              "",
            brandColorSecondary:
              validatedData.brandColorSecondary ||
              business.brandColorSecondary ||
              "",
          },
        });
      } catch (stripeError: any) {
        console.error("Failed to sync with Stripe:", stripeError);
        // Continue even if Stripe sync fails
      }
    }

    // Log the profile update
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: session.user.id,
        type: "BUSINESS_PROFILE_UPDATED",
        metadata: validatedData,
      },
    });

    return NextResponse.json(updatedBusiness);
  } catch (error: any) {
    console.error("Business profile update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.errors.map((e) => e.message).join(", "),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error?.message || "Failed to update business profile" },
      { status: 500 }
    );
  }
}

