import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getNextAction, determineBusinessState } from "@wine-club/lib";
import { stripe } from "@wine-club/lib";

/**
 * GET /api/onboarding/status
 * Returns current onboarding status and next action for the user's business
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find user's business
    const business = await prisma.business.findFirst({
      where: {
        users: {
          some: {
            userId: session.user.id,
          },
        },
      },
      include: {
        users: {
          where: {
            userId: session.user.id,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({
        hasBusiness: false,
        status: null,
        nextAction: {
          action: "complete_details",
          message: "Create your business to get started",
          canAccessDashboard: false,
        },
      });
    }

    // Fetch fresh Stripe account state if account exists
    let stripeAccountState: any = null;
    if (business.stripeAccountId) {
      try {
        const account = await stripe.accounts.retrieve(business.stripeAccountId);
        stripeAccountState = {
          id: account.id,
          charges_enabled: account.charges_enabled,
          details_submitted: account.details_submitted,
          payouts_enabled: account.payouts_enabled,
          requirements: account.requirements,
          capabilities: account.capabilities,
        };
      } catch (error) {
        console.error("Failed to fetch Stripe account:", error);
        // Continue with cached state from database
        stripeAccountState = {
          id: business.stripeAccountId,
          charges_enabled: business.stripeChargesEnabled,
          details_submitted: business.stripeDetailsSubmitted,
          requirements: business.stripeRequirements,
        };
      }
    }

    // Determine current state (prefer live Stripe data over cached)
    const currentStatus = stripeAccountState
      ? determineBusinessState(business.status, stripeAccountState as any)
      : business.status;

    // Get next action guidance
    const nextAction = getNextAction(currentStatus, stripeAccountState);

    // Return comprehensive status
    return NextResponse.json({
      hasBusiness: true,
      businessId: business.id,
      businessName: business.name,
      slug: business.slug,
      status: currentStatus,
      stripeAccountId: business.stripeAccountId,
      stripeChargesEnabled: business.stripeChargesEnabled,
      stripeDetailsSubmitted: business.stripeDetailsSubmitted,
      stripeRequirements: business.stripeRequirements,
      nextAction,
      stateTransitions: business.stateTransitions,
    });
  } catch (error: any) {
    console.error("Onboarding status error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch onboarding status" },
      { status: 500 }
    );
  }
}

