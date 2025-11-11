import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { validateBusinessSlug } from "@/lib/slug-validator";
import { z } from "zod";

const createBusinessSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, "Invalid slug format"),
  country: z.string().length(2).default("US"),
  currency: z.string().length(3).default("USD"),
  timeZone: z.string().default("America/New_York"),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createBusinessSchema.parse(body);

    // Validate slug
    const slugError = await validateBusinessSlug(data.slug);
    if (slugError) {
      return NextResponse.json(
        { error: slugError, field: "slug" },
        { status: 400 }
      );
    }

    // Create business and link user as OWNER
    const business = await prisma.business.create({
      data: {
        name: data.name,
        slug: data.slug,
        status: "CREATED",
        country: data.country,
        currency: data.currency,
        timeZone: data.timeZone,
        users: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: session.user.id,
        type: "BUSINESS_CREATED",
        metadata: {
          businessName: business.name,
          slug: business.slug,
        },
      },
    });

    return NextResponse.json(business, { status: 201 });
  } catch (error) {
    console.error("Create business error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}

