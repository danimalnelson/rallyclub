import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function POST(req: NextRequest) {
  // Guard: Only allow test endpoints in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const { businessId, status = "ONBOARDING_COMPLETE", contactEmail, contactPhone } = await req.json();

  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      users: {
        take: 1,
      },
    },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const result = await prisma.business.update({
    where: { id: businessId },
    data: {
      status,
      stripeAccountId: business.stripeAccountId ?? `acct_mock_${businessId}`,
      contactEmail: contactEmail ?? business.contactEmail,
      contactPhone: contactPhone ?? business.contactPhone,
    },
  });

  if (business.users.length > 0) {
    await prisma.auditLog.create({
      data: {
        businessId: result.id,
        actorUserId: business.users[0].userId,
        type: "STRIPE_ONBOARDING_COMPLETE",
        metadata: {
          mock: true,
          status,
        },
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, business: result });
}
