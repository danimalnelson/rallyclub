import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { createConnectedProduct, createConnectedPrice } from "@wine-club/lib";
import { z } from "zod";

const monthlyPriceSchema = z.object({
  month: z.string(), // "2025-11" format
  price: z.number().int().positive(), // In cents
  isCurrent: z.boolean(),
});

const createPlanSchema = z.object({
  membershipId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
  pricingType: z.enum(["FIXED", "DYNAMIC"]),
  basePrice: z.number().int().positive().optional().nullable(), // In cents (for FIXED)
  monthlyPrices: z.array(monthlyPriceSchema).optional(), // For DYNAMIC
  currency: z.string().default("usd"),
  interval: z.enum(["WEEK", "MONTH", "YEAR"]),
  intervalCount: z.number().int().positive().default(1),
  setupFee: z.number().int().min(0).optional().nullable(),
  recurringFee: z.number().int().min(0).optional().nullable(),
  recurringFeeName: z.string().max(100).optional().nullable(),
  shippingFee: z.number().int().min(0).optional().nullable(),
  stockStatus: z.enum(["AVAILABLE", "SOLD_OUT", "COMING_SOON", "WAITLIST"]).default("AVAILABLE"),
  maxSubscribers: z.number().int().positive().optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
}).refine((data) => {
  // If recurringFee is set, recurringFeeName must be provided
  if (data.recurringFee && data.recurringFee > 0 && !data.recurringFeeName) {
    return false;
  }
  return true;
}, {
  message: "Recurring fee requires a fee name",
  path: ["recurringFeeName"],
}).refine((data) => {
  // Dynamic pricing requires at least one monthly price (current month)
  if (data.pricingType === "DYNAMIC" && (!data.monthlyPrices || data.monthlyPrices.length === 0)) {
    return false;
  }
  // Dynamic pricing must have a current month price
  if (data.pricingType === "DYNAMIC" && data.monthlyPrices && !data.monthlyPrices.some(mp => mp.isCurrent)) {
    return false;
  }
  return true;
}, {
  message: "Dynamic pricing requires at least one price for the current month",
  path: ["monthlyPrices"],
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createPlanSchema.parse(body);

    // Get membership and verify user has access
    const membership = await prisma.membership.findFirst({
      where: {
        id: data.membershipId,
        business: {
          users: {
            some: {
              userId: session.user.id,
              role: {
                in: ["OWNER", "ADMIN"],
              },
            },
          },
        },
      },
      include: {
        business: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found or access denied" },
        { status: 404 }
      );
    }

    if (!membership.business.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not connected" },
        { status: 400 }
      );
    }

    // Validation: Fixed pricing requires basePrice
    if (data.pricingType === "FIXED" && !data.basePrice) {
      return NextResponse.json(
        { error: "Fixed pricing requires a base price" },
        { status: 400 }
      );
    }

    // Validation: Cannot activate dynamic plan without current price
    if (data.pricingType === "DYNAMIC" && data.status === "ACTIVE") {
      const hasCurrentPrice = data.monthlyPrices?.some(mp => mp.isCurrent);
      if (!hasCurrentPrice) {
        return NextResponse.json(
          { error: "Cannot activate dynamic plan without setting a current month price" },
          { status: 400 }
        );
      }
    }

    // Create Stripe Product on connected account
    const stripeProduct = await createConnectedProduct(
      membership.business.stripeAccountId,
      {
        name: data.name,
        description: data.description || undefined,
        metadata: {
          businessId: membership.businessId,
          membershipId: membership.id,
          pricingType: data.pricingType,
        },
      }
    );

    // Create Stripe Price based on pricing type
    let stripePriceId: string | undefined;
    let currentMonthPrice: typeof data.monthlyPrices[0] | undefined;

    if (data.pricingType === "FIXED" && data.basePrice) {
      // Fixed pricing: Create one Stripe Price
      const stripePrice = await createConnectedPrice(
        membership.business.stripeAccountId,
        {
          productId: stripeProduct.id,
          unitAmount: data.basePrice,
          currency: data.currency,
          interval: membership.billingInterval.toLowerCase() as "week" | "month" | "year",
          intervalCount: 1,  // Always 1 (monthly = 1 month, etc.)
          nickname: `${data.name} - ${membership.billingInterval.toLowerCase()}ly`,
          metadata: {
            planName: data.name,
            membershipId: membership.id,
          },
        }
      );
      stripePriceId = stripePrice.id;
    } else if (data.pricingType === "DYNAMIC" && data.monthlyPrices) {
      // Dynamic pricing: Create Stripe Price for current month only
      currentMonthPrice = data.monthlyPrices.find(mp => mp.isCurrent);
      if (currentMonthPrice) {
        const stripePrice = await createConnectedPrice(
          membership.business.stripeAccountId,
          {
            productId: stripeProduct.id,
            unitAmount: currentMonthPrice.price,
            currency: data.currency,
            interval: membership.billingInterval.toLowerCase() as "week" | "month" | "year",
            intervalCount: 1,
            nickname: `${data.name} - ${currentMonthPrice.month}`,
            metadata: {
              planName: data.name,
              membershipId: membership.id,
              effectiveMonth: currentMonthPrice.month,
            },
          }
        );
        stripePriceId = stripePrice.id;
      }
    }

    // Create plan in database
    const plan = await prisma.plan.create({
      data: {
        businessId: membership.businessId,
        membershipId: membership.id,
        name: data.name,
        description: data.description,
        pricingType: data.pricingType,
        basePrice: data.basePrice,
        currency: data.currency,
        // interval and intervalCount removed - inherited from membership
        setupFee: data.setupFee,
        recurringFee: data.recurringFee,
        recurringFeeName: data.recurringFeeName,
        shippingFee: data.shippingFee,
        stockStatus: data.stockStatus,
        maxSubscribers: data.maxSubscribers,
        status: data.status,
        stripeProductId: stripeProduct.id,
        stripePriceId: stripePriceId,
      },
    });

    // Create PriceQueueItems for dynamic pricing
    if (data.pricingType === "DYNAMIC" && data.monthlyPrices) {
      const queueItems = data.monthlyPrices.map((mp) => {
        // Parse month string to get first day of month
        const [year, month] = mp.month.split('-').map(Number);
        const effectiveAt = new Date(year, month - 1, 1, 0, 0, 0, 0);

        return {
          planId: plan.id,
          effectiveAt,
          price: mp.price,
          applied: mp.isCurrent, // Current month is already applied
          stripePriceId: mp.isCurrent ? stripePriceId : null, // Only current month has Stripe Price
        };
      });

      await prisma.priceQueueItem.createMany({
        data: queueItems,
      });

      console.log(`[Plan Create] Created ${queueItems.length} price queue items for dynamic plan`);
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: membership.businessId,
        actorUserId: session.user.id,
        type: "PLAN_CREATED",
        metadata: {
          planId: plan.id,
          planName: plan.name,
          membershipId: membership.id,
          stripeProductId: stripeProduct.id,
          stripePriceId: stripePriceId,
        },
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Create plan error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create plan", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
