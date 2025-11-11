import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@wine-club/db";
import { stripe, createAccountLink } from "@wine-club/lib";
import { z } from "zod";

const schema = z.object({
  businessId: z.string(),
  refreshUrl: z.string().url(),
  returnUrl: z.string().url(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId, refreshUrl, returnUrl } = schema.parse(body);

    // Verify user has access to business
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

    let accountId = business.stripeAccountId;

    // Create Stripe Connect account if doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: session.user.email!,
        business_profile: {
          name: business.name,
        },
        metadata: {
          businessId: business.id,
        },
      });

      accountId = account.id;

      const updateData: Prisma.BusinessUpdateInput = {
        stripeAccountId: accountId,
      };

      if (business.status !== "ONBOARDING_COMPLETE") {
        updateData.status = "ONBOARDING_PENDING";
      }

      await prisma.business.update({
        where: { id: business.id },
        data: updateData,
      });
    } else if (business.status !== "ONBOARDING_COMPLETE") {
      await prisma.business.update({
        where: { id: business.id },
        data: {
          status: "ONBOARDING_PENDING",
        },
      });
    }

    // Create account link
    const url = await createAccountLink({
      accountId,
      refreshUrl,
      returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Connect account link error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid request: " + error.errors.map(e => e.message).join(", ")
      }, { status: 400 });
    }
    
    // Handle Stripe errors
    if (error?.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message || "Invalid Stripe request" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error?.message || "Failed to create account link" },
      { status: 500 }
    );
  }
}

