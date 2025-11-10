import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { createConnectedProduct } from "@wine-club/lib";
import { z } from "zod";

const createPlanSchema = z.object({
  businessId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  benefits: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId, name, description, benefits } = createPlanSchema.parse(body);

    // Verify user has access
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
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (!business.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not connected" },
        { status: 400 }
      );
    }

    // Create Stripe Product on connected account
    const stripeProduct = await createConnectedProduct(business.stripeAccountId, {
      name,
      description: description || undefined,
      metadata: {
        businessId: business.id,
      },
    });

    // Create plan in database
    const plan = await prisma.membershipPlan.create({
      data: {
        businessId: business.id,
        name,
        description,
        status: "ACTIVE",
        benefits: benefits ? { items: benefits } : undefined,
        stripeProductId: stripeProduct.id,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorUserId: session.user.id,
        type: "PLAN_CREATED",
        metadata: {
          planId: plan.id,
          planName: plan.name,
        },
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Create plan error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}

