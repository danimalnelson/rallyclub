import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "the-ruby-tap";

    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        memberships: {
          include: {
            plans: {
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const plansSummary = business.memberships.flatMap((membership) =>
      membership.plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        membershipName: membership.name,
        status: plan.status,
        stockStatus: plan.stockStatus,
        basePrice: plan.basePrice,
        createdAt: plan.createdAt,
        visibleOnPublicPage: plan.status === "ACTIVE",
      }))
    );

    return NextResponse.json({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
      },
      allPlans: plansSummary,
      visiblePlans: plansSummary.filter((p) => p.visibleOnPublicPage),
      help: {
        message:
          "Plans must have status='ACTIVE' to show on the public page. Check the 'visibleOnPublicPage' field.",
        publicPageUrl: `${process.env.PUBLIC_APP_URL || "https://membership-saas-web.vercel.app"}/${slug}`,
      },
    });
  } catch (error: any) {
    console.error("Plan visibility debug error:", error);
    return NextResponse.json(
      { error: "Failed to check plan visibility", details: error.message },
      { status: 500 }
    );
  }
}

