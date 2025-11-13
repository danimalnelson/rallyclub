import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        membershipPlans: {
          where: { status: "ACTIVE" },
          include: {
            prices: {
              orderBy: { unitAmount: "asc" },
            },
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // TypeScript infers proper types from Prisma's include
    return NextResponse.json({
      business: {
        name: business.name,
        slug: business.slug,
        logoUrl: business.logoUrl,
      },
      plans: business.membershipPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        benefits: plan.benefits,
        prices: plan.prices.map((price) => ({
          id: price.id,
          nickname: price.nickname,
          interval: price.interval,
          unitAmount: price.unitAmount,
          currency: price.currency,
          isDefault: price.isDefault,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 }
    );
  }
}

