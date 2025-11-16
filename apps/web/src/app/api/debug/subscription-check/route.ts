import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json(
      { error: "Email parameter required. Usage: /api/debug/subscription-check?email=your@email.com" },
      { status: 400 }
    );
  }

  try {
    // Find consumer
    const consumer = await prisma.consumer.findUnique({
      where: { email },
      include: {
        planSubscriptions: {
          include: {
            plan: {
              include: {
                membership: true,
                business: true,
              },
            },
          },
        },
      },
    });

    if (!consumer) {
      return NextResponse.json({
        found: false,
        message: `No consumer found with email: ${email}`,
      });
    }

    // Check webhook events
    const recentWebhooks = await prisma.webhookEvent.findMany({
      where: {
        type: {
          in: [
            "checkout.session.completed",
            "customer.subscription.created",
            "customer.subscription.updated",
          ],
        },
      },
      orderBy: {
        id: "desc",
      },
      take: 10,
    });

    return NextResponse.json({
      found: true,
      consumer: {
        id: consumer.id,
        email: consumer.email,
        name: consumer.name,
        createdAt: consumer.createdAt,
      },
      planSubscriptions: consumer.planSubscriptions.map(ps => ({
        id: ps.id,
        status: ps.status,
        stripeSubscriptionId: ps.stripeSubscriptionId,
        stripeCustomerId: ps.stripeCustomerId,
        currentPeriodStart: ps.currentPeriodStart,
        currentPeriodEnd: ps.currentPeriodEnd,
        plan: {
          name: ps.plan.name,
          basePrice: ps.plan.basePrice,
          interval: ps.plan.membership.billingInterval,
        },
        membership: {
          name: ps.plan.membership.name,
        },
        business: {
          name: ps.plan.business.name,
          slug: ps.plan.business.slug,
        },
        createdAt: ps.createdAt,
      })),
      recentWebhooks: recentWebhooks.map(wh => ({
        type: wh.type,
        processed: wh.processed,
        signatureValid: wh.signatureValid,
        processingError: wh.processingError,
        accountId: wh.accountId,
      })),
    });
  } catch (error: any) {
    console.error("Debug subscription check error:", error);
    return NextResponse.json(
      { error: "Failed to check subscriptions", details: error.message },
      { status: 500 }
    );
  }
}

