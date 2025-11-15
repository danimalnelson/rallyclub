import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json(
      { error: "Slug parameter required. Usage: /api/debug/business-data?slug=your-slug" },
      { status: 400 }
    );
  }

  try {
    // Check if business exists
    const business = await prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        stripeAccountId: true,
      },
    });

    if (!business) {
      return NextResponse.json({
        found: false,
        message: `No business found with slug: ${slug}`,
      });
    }

    // Get memberships
    const memberships = await prisma.membership.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        name: true,
        status: true,
        _count: {
          select: { plans: true },
        },
      },
    });

    // Get plans
    const plans = await prisma.plan.findMany({
      where: { businessId: business.id },
      select: {
        id: true,
        name: true,
        status: true,
        basePrice: true,
        interval: true,
        membershipId: true,
      },
    });

    // Query same as public page
    const publicPageQuery = await prisma.business.findUnique({
      where: { slug },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          include: {
            plans: {
              where: { status: "ACTIVE" },
            },
          },
        },
      },
    });

    return NextResponse.json({
      found: true,
      business,
      allMemberships: memberships,
      allPlans: plans,
      publicPageResult: {
        businessFound: !!publicPageQuery,
        activeMembershipsCount: publicPageQuery?.memberships.length || 0,
        activeMemberships: publicPageQuery?.memberships.map(m => ({
          id: m.id,
          name: m.name,
          status: m.status,
          plansCount: m.plans.length,
          plans: m.plans.map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            basePrice: p.basePrice,
          })),
        })) || [],
      },
    });
  } catch (error: any) {
    console.error("Debug business data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data", details: error.message },
      { status: 500 }
    );
  }
}

