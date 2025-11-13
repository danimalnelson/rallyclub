import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { stripe, determineBusinessState, createStateTransition, appendTransition } from "@wine-club/lib";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessId } = await params;

  // Verify user owns this business
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  if (!business.stripeAccountId) {
    return NextResponse.json({ error: "No Stripe account connected" }, { status: 400 });
  }

  try {
    console.log(`[SYNC] Fetching Stripe account: ${business.stripeAccountId}`);
    
    // Fetch latest from Stripe
    const account = await stripe.accounts.retrieve(business.stripeAccountId);

    console.log(`[SYNC] Stripe response:`, {
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
    });

    // Determine new state
    const stripeAccountState = {
      id: account.id,
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements,
      capabilities: account.capabilities,
    };

    const newStatus = determineBusinessState(business.status, stripeAccountState);
    const statusChanged = newStatus !== business.status;

    console.log(`[SYNC] Status: ${business.status} → ${newStatus}`);

    // Update database
    const updateData: any = {
      stripeChargesEnabled: account.charges_enabled,
      stripeDetailsSubmitted: account.details_submitted,
      stripeRequirements: account.requirements || null,
    };

    if (statusChanged) {
      updateData.status = newStatus;
      
      const transition = createStateTransition(
        business.status,
        newStatus,
        `Manual sync from Stripe (local dev)`,
        undefined
      );
      
      updateData.stateTransitions = appendTransition(
        business.stateTransitions as any,
        transition
      ) as any;
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: updateData,
      select: {
        id: true,
        name: true,
        status: true,
        stripeChargesEnabled: true,
        stripeDetailsSubmitted: true,
      },
    });

    console.log(`[SYNC] ✅ Updated business:`, updated);

    return NextResponse.json({
      success: true,
      statusChanged,
      oldStatus: business.status,
      newStatus: updated.status,
      business: updated,
    });
  } catch (error: any) {
    console.error("[SYNC] Error:", error);
    return NextResponse.json({
      error: "Failed to sync with Stripe",
      message: error.message,
    }, { status: 500 });
  }
}

