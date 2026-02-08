import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getStripeClient } from "@wine-club/lib";
import { sendBusinessEmail, subscriptionPausedAlertEmail } from "@wine-club/emails";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ subscriptionId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subscriptionId } = await context.params;

    // Get subscription and verify access
    const planSubscription = await prisma.planSubscription.findUnique({
      where: { id: subscriptionId },
      include: {
        consumer: true,
        plan: {
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
        },
      },
    });

    if (!planSubscription) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    if (planSubscription.plan.business.users.length === 0) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const stripe = getStripeClient(planSubscription.plan.business.stripeAccountId!);

    // Pause subscription in Stripe
    const updated = await stripe.subscriptions.update(
      planSubscription.stripeSubscriptionId,
      {
        pause_collection: {
          behavior: "keep_as_draft",
        },
      }
    );

    // Update local status (webhook will also handle this)
    await prisma.planSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: updated.status,
        pausedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });

    // Notify business owner
    const business = planSubscription.plan.business;
    if (business.contactEmail) {
      const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";
      await sendBusinessEmail(
        business.contactEmail,
        `Subscription Paused - ${planSubscription.consumer.name || planSubscription.consumer.email}`,
        subscriptionPausedAlertEmail({
          businessName: business.name,
          memberName: planSubscription.consumer.name || "Member",
          memberEmail: planSubscription.consumer.email,
          planName: planSubscription.plan.name,
          pausedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          dashboardUrl: `${publicAppUrl}/app/${business.slug}/members`,
        })
      ).catch((err) => console.error("Failed to send pause notification:", err));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Pause subscription error:", error);
    return NextResponse.json(
      { error: "Failed to pause subscription", details: error.message },
      { status: 500 }
    );
  }
}

