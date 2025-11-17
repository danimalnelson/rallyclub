import { NextResponse } from "next/server";
import { prisma } from "@wine-club/db";

export async function GET() {
  try {
    // Get all subscriptions
    const allSubs = await prisma.planSubscription.findMany({
      include: {
        consumer: {
          select: {
            email: true,
            name: true,
          },
        },
        plan: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group by email
    const byEmail: Record<string, any[]> = {};
    allSubs.forEach(sub => {
      const email = sub.consumer.email;
      if (!byEmail[email]) {
        byEmail[email] = [];
      }
      byEmail[email].push({
        id: sub.id,
        plan: sub.plan.name,
        status: sub.status,
        stripeSubscriptionId: sub.stripeSubscriptionId,
        createdAt: sub.createdAt,
      });
    });

    return NextResponse.json({
      total: allSubs.length,
      byEmail,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


