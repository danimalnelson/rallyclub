import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all consumers without names
    const consumersWithoutNames = await prisma.consumer.findMany({
      where: {
        name: null,
        planSubscriptions: {
          some: {},
        },
      },
      include: {
        planSubscriptions: {
          include: {
            plan: {
              include: {
                business: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    const results = [];

    for (const consumer of consumersWithoutNames) {
      try {
        const subscription = consumer.planSubscriptions[0];
        if (!subscription) continue;

        const stripeAccountId = subscription.plan.business.stripeAccountId;
        if (!stripeAccountId) continue;

        // Retrieve customer from Stripe
        const stripeCustomer = await stripe.customers.retrieve(
          subscription.stripeCustomerId,
          {
            stripeAccount: stripeAccountId,
          }
        );

        if (stripeCustomer.deleted) continue;

        const customerName = stripeCustomer.name;
        const customerPhone = stripeCustomer.phone;

        if (!customerName && !customerPhone) continue;

        // Update consumer
        await prisma.consumer.update({
          where: { id: consumer.id },
          data: {
            ...(customerName && { name: customerName }),
            ...(customerPhone && { phone: customerPhone }),
          },
        });

        results.push({
          email: consumer.email,
          name: customerName,
          phone: customerPhone,
          status: "updated",
        });
      } catch (error: any) {
        results.push({
          email: consumer.email,
          status: "error",
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: consumersWithoutNames.length,
      updated: results.filter((r) => r.status === "updated").length,
    });
  } catch (error: any) {
    console.error("Sync customer names error:", error);
    return NextResponse.json(
      { error: "Failed to sync customer names", details: error.message },
      { status: 500 }
    );
  }
}

