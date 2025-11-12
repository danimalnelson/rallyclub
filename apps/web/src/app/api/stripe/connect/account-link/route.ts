import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma, Prisma } from "@wine-club/db";
import { stripe, createAccountLink, createStateTransition, appendTransition } from "@wine-club/lib";
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
    const isMockMode = process.env.MOCK_STRIPE_CONNECT === "true";
    let newStatus = business.status;
    let statusChanged = false;

    // Create Stripe Connect account if doesn't exist (idempotent)
    if (!accountId) {
      console.log(`[Connect] Creating Stripe account for business ${business.id}`);
      
      if (isMockMode) {
        accountId = `acct_mock_${business.id}`;
      } else {
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
      }

      // Transition to STRIPE_ACCOUNT_CREATED
      if (business.status === "CREATED" || business.status === "DETAILS_COLLECTED") {
        newStatus = "STRIPE_ACCOUNT_CREATED";
        statusChanged = true;
      }
    }

    // Check if account is onboarding or needs re-onboarding
    if (accountId && !isMockMode) {
      try {
        const account = await stripe.accounts.retrieve(accountId);
        
        // If already complete, don't allow re-onboarding
        if (account.charges_enabled && account.details_submitted) {
          console.log(`[Connect] Account ${accountId} already complete`);
          return NextResponse.json({
            url: null,
            alreadyComplete: true,
            message: "Your Stripe account is already fully set up",
          });
        }
        
        // Update status to IN_PROGRESS when generating link
        if (business.status !== "ONBOARDING_COMPLETE") {
          newStatus = "STRIPE_ONBOARDING_IN_PROGRESS";
          statusChanged = statusChanged || (newStatus !== business.status);
        }
      } catch (error: any) {
        console.error(`[Connect] Failed to retrieve account ${accountId}:`, error.message);
        // Continue anyway to allow account link creation
      }
    }

    // Update business with account ID and new status
    if (accountId !== business.stripeAccountId || statusChanged) {
      const updateData: Prisma.BusinessUpdateInput = {
        stripeAccountId: accountId,
      };

      if (statusChanged) {
        updateData.status = newStatus;
        
        // Create state transition
        const transition = createStateTransition(
          business.status,
          newStatus,
          `Stripe Connect account ${accountId ? 'created' : 'onboarding initiated'}`,
          undefined
        );
        
        updateData.stateTransitions = appendTransition(
          business.stateTransitions as any,
          transition
        ) as any;
      }

      await prisma.business.update({
        where: { id: business.id },
        data: updateData,
      });
      
      console.log(`[Connect] Updated business ${business.id}: ${business.status} → ${newStatus}`);
    }

    // Generate account link
    let url: string;

    if (isMockMode) {
      url = `${returnUrl}&mockStripe=1`;
    } else {
      url = await createAccountLink({
        accountId: accountId!,
        refreshUrl,
        returnUrl,
        type: "account_onboarding",
      });
    }

    console.log(`[Connect] Generated account link for business ${business.id}`);
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("Connect account link error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid request: " + error.errors.map(e => e.message).join(", ")
      }, { status: 400 });
    }
    
    // Handle Stripe errors
    if (error?.type === "StripeInvalidRequestError") {
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

