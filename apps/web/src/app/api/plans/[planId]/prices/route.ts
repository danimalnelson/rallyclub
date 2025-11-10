import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { createConnectedPrice } from "@wine-club/lib";
import { z } from "zod";

const createPriceSchema = z.object({
  nickname: z.string().max(100).optional(),
  interval: z.enum(["month", "year"]),
  unitAmount: z.number().int().positive(),
  currency: z.string().length(3).default("USD"),
  trialDays: z.number().int().nonnegative().optional(),
  isDefault: z.boolean().default(false),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { planId } = await params;
    const body = await req.json();
    const data = createPriceSchema.parse(body);

    // Get plan with business
    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId },
      include: {
        business: {
          include: {
            users: {
              where: {
                userId: session.user.id,
                role: {
                  in: ["OWNER", "ADMIN"],
                },
              },
            },
          },
        },
      },
    });

    if (!plan || plan.business.users.length === 0) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (!plan.business.stripeAccountId || !plan.stripeProductId) {
      return NextResponse.json(
        { error: "Stripe setup incomplete" },
        { status: 400 }
      );
    }

    // Create Stripe Price on connected account
    const stripePrice = await createConnectedPrice(plan.business.stripeAccountId, {
      productId: plan.stripeProductId,
      unitAmount: data.unitAmount,
      currency: data.currency,
      interval: data.interval,
      nickname: data.nickname,
      trialPeriodDays: data.trialDays,
      metadata: {
        planId: plan.id,
        businessId: plan.business.id,
      },
    });

    // If this should be default, unset other defaults
    if (data.isDefault) {
      await prisma.price.updateMany({
        where: {
          membershipPlanId: plan.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Create price in database
    const price = await prisma.price.create({
      data: {
        membershipPlanId: plan.id,
        nickname: data.nickname,
        interval: data.interval,
        unitAmount: data.unitAmount,
        currency: data.currency,
        trialDays: data.trialDays,
        stripePriceId: stripePrice.id,
        isDefault: data.isDefault,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: plan.business.id,
        actorUserId: session.user.id,
        type: "PRICE_CREATED",
        metadata: {
          planId: plan.id,
          priceId: price.id,
          amount: price.unitAmount,
          interval: price.interval,
        },
      },
    });

    return NextResponse.json(price);
  } catch (error) {
    console.error("Create price error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create price" }, { status: 500 });
  }
}

