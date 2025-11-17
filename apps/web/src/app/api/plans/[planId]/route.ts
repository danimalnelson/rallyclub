import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { createConnectedPrice, getStripeClient, resumePausedSubscriptions } from "@wine-club/lib";
import { z } from "zod";

const monthlyPriceSchema = z.object({
  month: z.string(), // "2025-11" format
  price: z.number().int().positive(), // In cents
  isCurrent: z.boolean(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).or(z.literal("")).optional().nullable(),
  pricingType: z.enum(["FIXED", "DYNAMIC"]).optional(),
  basePrice: z.union([z.number().int().positive(), z.null(), z.literal("")]).optional().nullable(),
  monthlyPrices: z.array(monthlyPriceSchema).optional(), // For DYNAMIC
  currency: z.string().optional(),
  interval: z.enum(["WEEK", "MONTH", "YEAR"]).optional(),
  intervalCount: z.number().int().positive().optional(),
  setupFee: z.union([z.number().int().min(0), z.null(), z.literal("")]).optional().nullable(),
  recurringFee: z.union([z.number().int().min(0), z.null(), z.literal("")]).optional().nullable(),
  recurringFeeName: z.string().max(100).or(z.literal("")).optional().nullable(),
  shippingFee: z.union([z.number().int().min(0), z.null(), z.literal("")]).optional().nullable(),
  stockStatus: z.enum(["AVAILABLE", "SOLD_OUT", "COMING_SOON", "WAITLIST"]).optional(),
  maxSubscribers: z.union([z.number().int().positive(), z.null(), z.literal("")]).optional().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

// GET: Fetch plan details
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { planId } = await context.params;

    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
        business: {
          users: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
      include: {
        membership: true,
        priceQueue: {
          orderBy: {
            effectiveAt: 'asc',
          },
        },
        _count: {
          select: {
            planSubscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Transform price queue into monthly prices format for the form
    let monthlyPrices = null;
    if (plan.pricingType === "DYNAMIC" && plan.priceQueue.length > 0) {
      const now = new Date();
      monthlyPrices = plan.priceQueue.map((qi) => ({
        month: qi.effectiveAt.toISOString().slice(0, 7),
        monthLabel: qi.effectiveAt.toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
        price: (qi.price / 100).toFixed(2), // Convert cents to dollars
        isCurrent: qi.applied && qi.effectiveAt <= now,
      }));
    }

    return NextResponse.json({
      ...plan,
      monthlyPrices,
    });
  } catch (error) {
    console.error("Get plan error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

// PUT: Update plan
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { planId } = await context.params;
    const body = await req.json();
    
    // Debug: Log monthlyPrices before processing
    if (body.monthlyPrices) {
      console.log('[Plan Update] monthlyPrices before processing:', JSON.stringify(body.monthlyPrices, null, 2));
    }
    
    // Preprocess: Convert empty strings to null and parse numeric strings in monthlyPrices
    const cleanedBody = Object.fromEntries(
      Object.entries(body).map(([key, value]) => {
        if (value === "") return [key, null];
        
        // Handle monthlyPrices array - convert price strings to numbers (cents)
        if (key === "monthlyPrices" && Array.isArray(value)) {
          const processedPrices = value
            .map((item: any) => {
              let price = item.price;
              
              // Skip entries with empty prices (for FIXED pricing plans)
              if (price === "" || price === null || price === undefined) {
                return null;
              }
              
              // If price is a string, parse it
              if (typeof price === "string") {
                // Remove $ and whitespace
                price = price.replace(/[\$\s]/g, '');
                
                // Parse as float and convert to cents
                const parsed = parseFloat(price);
                if (isNaN(parsed)) {
                  console.error(`Invalid price in monthlyPrices: ${item.price}`);
                  return null;
                }
                
                // If it looks like dollars (has decimal or < 100), convert to cents
                price = price.includes('.') || parsed < 100 ? Math.round(parsed * 100) : parsed;
              }
              
              return { ...item, price };
            })
            .filter((item: any) => item !== null);
          
          // If all prices are empty, omit monthlyPrices entirely
          return [key, processedPrices.length > 0 ? processedPrices : undefined];
        }
        
        return [key, value];
      })
    );
    
    const data = updatePlanSchema.parse(cleanedBody);

    // Get existing plan and verify access
    const existingPlan = await prisma.plan.findFirst({
      where: {
        id: planId,
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
        membership: true,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { error: "Plan not found or access denied" },
        { status: 404 }
      );
    }

    if (!existingPlan.business.stripeAccountId) {
      return NextResponse.json(
        { error: "Stripe account not connected" },
        { status: 400 }
      );
    }

    const stripe = getStripeClient(existingPlan.business.stripeAccountId);

    // Update Stripe Product if name or description changed
    if (data.name || data.description !== undefined) {
      if (existingPlan.stripeProductId) {
        await stripe.products.update(existingPlan.stripeProductId, {
          name: data.name || existingPlan.name,
          description: data.description === null ? "" : (data.description || existingPlan.description || undefined),
        });
      }
    }

    // Check if pricingType is changing
    const pricingTypeChanging =
      data.pricingType !== undefined && data.pricingType !== existingPlan.pricingType;

    let newStripePriceId: string | undefined;

    if (pricingTypeChanging) {
      console.log(`[Plan Update] Pricing type changing: ${existingPlan.pricingType} → ${data.pricingType}`);

      // DYNAMIC → FIXED: Update all subscriptions immediately
      if (existingPlan.pricingType === "DYNAMIC" && data.pricingType === "FIXED") {
        if (!data.basePrice) {
          return NextResponse.json(
            { error: "Must provide basePrice when changing to FIXED pricing" },
            { status: 400 }
          );
        }

        // Create new fixed price
        const fixedPrice = await createConnectedPrice(
          existingPlan.business.stripeAccountId,
          {
            productId: existingPlan.stripeProductId!,
            unitAmount: data.basePrice,
            currency: data.currency || existingPlan.currency,
            interval: existingPlan.membership.billingInterval.toLowerCase() as "week" | "month" | "year",
            intervalCount: 1,
            nickname: `${data.name || existingPlan.name} - Fixed`,
            metadata: {
              planName: data.name || existingPlan.name,
              membershipId: existingPlan.membershipId,
              pricingType: "FIXED",
            },
          }
        );

        newStripePriceId = fixedPrice.id;

        // Update ALL active subscriptions to new fixed price
        // Note: Status values are lowercase to match Stripe's format
        const activeSubscriptions = await prisma.planSubscription.findMany({
          where: {
            planId: existingPlan.id,
            status: { in: ["active", "trialing", "paused"] },
          },
        });

        console.log(`[Plan Update] Updating ${activeSubscriptions.length} subscriptions to fixed price`);

        for (const sub of activeSubscriptions) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

            await stripe.subscriptions.update(sub.stripeSubscriptionId, {
              items: [
                {
                  id: stripeSub.items.data[0].id,
                  price: fixedPrice.id,
                },
              ],
              proration_behavior: "none", // Don't prorate, apply at next billing
              metadata: {
                ...stripeSub.metadata,
                pricingType: "FIXED",
                priceUpdatedAt: new Date().toISOString(),
              },
            });

            console.log(`[Plan Update] ✅ Updated subscription ${sub.id} to fixed price`);
          } catch (error) {
            console.error(`[Plan Update] ❌ Failed to update subscription ${sub.id}:`, error);
            // Continue with others
          }
        }

        // Archive old dynamic prices
        await prisma.priceQueueItem.updateMany({
          where: {
            planId: existingPlan.id,
            applied: false, // Only future prices
          },
          data: {
            applied: true, // Mark as "processed" (archived)
          },
        });

        console.log(`[Plan Update] ✅ Changed to FIXED pricing, updated ${activeSubscriptions.length} subscription(s)`);
      }

      // FIXED → DYNAMIC: Webhook will handle transition at next billing
      if (existingPlan.pricingType === "FIXED" && data.pricingType === "DYNAMIC") {
        if (!data.monthlyPrices || data.monthlyPrices.length === 0) {
          return NextResponse.json(
            { error: "Must provide monthlyPrices when changing to DYNAMIC pricing" },
            { status: 400 }
          );
        }

        const currentMonthPrice = data.monthlyPrices.find((mp) => mp.isCurrent);
        if (!currentMonthPrice) {
          return NextResponse.json(
            { error: "Must set current month's price when changing to DYNAMIC pricing" },
            { status: 400 }
          );
        }

        // Create current month's price
        const dynamicPrice = await createConnectedPrice(
          existingPlan.business.stripeAccountId,
          {
            productId: existingPlan.stripeProductId!,
            unitAmount: currentMonthPrice.price,
            currency: data.currency || existingPlan.currency,
            interval: existingPlan.membership.billingInterval.toLowerCase() as "week" | "month" | "year",
            intervalCount: 1,
            nickname: `${data.name || existingPlan.name} - ${currentMonthPrice.month}`,
            metadata: {
              planName: data.name || existingPlan.name,
              membershipId: existingPlan.membershipId,
              effectiveMonth: currentMonthPrice.month,
              pricingType: "DYNAMIC",
            },
          }
        );

        newStripePriceId = dynamicPrice.id;

        // Create PriceQueueItem records for all monthly prices
        const priceQueueItems = data.monthlyPrices.map((mp) => ({
          planId: existingPlan.id,
          price: mp.price,
          effectiveAt: new Date(`${mp.month}-01`), // "2025-11" -> "2025-11-01"
          applied: mp.isCurrent, // Current month is already applied
          stripePriceId: mp.isCurrent ? dynamicPrice.id : null, // Only current has stripePriceId
        }));

        await prisma.priceQueueItem.createMany({
          data: priceQueueItems,
        });

        console.log(`[Plan Update] ✅ Created ${priceQueueItems.length} price queue items`);

        // Note: We DON'T update existing subscriptions here
        // The webhook will handle it at their next billing cycle

        console.log(`[Plan Update] ✅ Changed to DYNAMIC pricing. Webhook will update subscriptions at next billing.`);
      }
    }

    // Check if price needs to be updated (create new Price in Stripe)
    const priceChanged =
      data.basePrice !== undefined && data.basePrice !== existingPlan.basePrice;

    if (
      existingPlan.pricingType === "FIXED" &&
      existingPlan.stripeProductId &&
      priceChanged
    ) {
      // Create new Stripe Price (Stripe doesn't allow price updates)
      // Use interval from membership (not from plan)
      const newPrice = await createConnectedPrice(
        existingPlan.business.stripeAccountId,
        {
          productId: existingPlan.stripeProductId,
          unitAmount: data.basePrice || existingPlan.basePrice || 0,
          currency: data.currency || existingPlan.currency,
          interval: existingPlan.membership.billingInterval.toLowerCase() as
            | "week"
            | "month"
            | "year",
          intervalCount: 1,  // Always 1
          nickname: `${data.name || existingPlan.name} - Updated`,
          metadata: {
            planName: data.name || existingPlan.name,
            membershipId: existingPlan.membershipId,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      newStripePriceId = newPrice.id;

      // Archive old price
      if (existingPlan.stripePriceId) {
        await stripe.prices.update(existingPlan.stripePriceId, {
          active: false,
        });
      }
    }

    // Handle dynamic pricing updates
    let currentPriceChanged = false; // Track if current price changed (for resume logic)
    
    if (existingPlan.pricingType === "DYNAMIC" && data.monthlyPrices) {
      const currentMonthPrice = data.monthlyPrices.find(mp => mp.isCurrent);
      
      if (currentMonthPrice) {
        // Get the currently applied price from the queue
        const currentQueueItem = await prisma.priceQueueItem.findFirst({
          where: {
            planId: existingPlan.id,
            applied: true,
            effectiveAt: {
              lte: new Date(),
            },
          },
          orderBy: {
            effectiveAt: 'desc',
          },
        });

        // Check if current month price changed
        currentPriceChanged = !currentQueueItem || currentQueueItem.price !== currentMonthPrice.price;

        if (currentPriceChanged && existingPlan.stripeProductId) {
          // Create new Stripe Price for current month
          const newPrice = await createConnectedPrice(
            existingPlan.business.stripeAccountId,
            {
              productId: existingPlan.stripeProductId,
              unitAmount: currentMonthPrice.price,
              currency: data.currency || existingPlan.currency,
              interval: existingPlan.membership.billingInterval.toLowerCase() as
                | "week"
                | "month"
                | "year",
              intervalCount: 1,
              nickname: `${data.name || existingPlan.name} - ${currentMonthPrice.month}`,
              metadata: {
                planName: data.name || existingPlan.name,
                membershipId: existingPlan.membershipId,
                effectiveMonth: currentMonthPrice.month,
              },
            }
          );
          newStripePriceId = newPrice.id;

          // Archive old price
          if (existingPlan.stripePriceId) {
            await stripe.prices.update(existingPlan.stripePriceId, {
              active: false,
            });
          }
        }
      }

      // Sync price queue items
      // Delete future (unapplied) prices
      await prisma.priceQueueItem.deleteMany({
        where: {
          planId: existingPlan.id,
          applied: false,
        },
      });

      // Create new price queue items
      const queueItems = data.monthlyPrices.map((mp) => {
        const [year, month] = mp.month.split('-').map(Number);
        const effectiveAt = new Date(year, month - 1, 1, 0, 0, 0, 0);

        return {
          planId: existingPlan.id,
          effectiveAt,
          price: mp.price,
          applied: mp.isCurrent, // Current month is already applied
          stripePriceId: mp.isCurrent && newStripePriceId ? newStripePriceId : null,
        };
      });

      await prisma.priceQueueItem.createMany({
        data: queueItems,
      });

      console.log(`[Plan Update] Synced ${queueItems.length} price queue items for dynamic plan`);
      
      // If current price was changed/added, resume any paused subscriptions
      if (newStripePriceId && currentPriceChanged) {
        console.log(`[Plan Update] Current price changed, checking for paused subscriptions...`);
        
        try {
          const resumeResult = await resumePausedSubscriptions(
            existingPlan.id,
            newStripePriceId,
            existingPlan.business.stripeAccountId
          );
          
          console.log(`[Plan Update] Resume result:`, resumeResult);
          
          if (resumeResult.resumed > 0) {
            // Create alert for business owner
            await prisma.businessAlert.create({
              data: {
                businessId: existingPlan.businessId,
                type: "SUBSCRIPTION_PAUSED", // Using same type but with positive message
                severity: "INFO",
                title: `${resumeResult.resumed} Subscription(s) Resumed`,
                message: `Price added for ${existingPlan.name}. ${resumeResult.resumed} paused subscription(s) have been resumed and charged.`,
                resolved: true, // Pre-resolved since it's a success message
                resolvedAt: new Date(),
                metadata: {
                  planId: existingPlan.id,
                  planName: existingPlan.name,
                  resumed: resumeResult.resumed,
                  charged: resumeResult.charged,
                  errors: resumeResult.errors,
                },
              },
            });
          }
        } catch (error) {
          console.error(`[Plan Update] Error resuming subscriptions:`, error);
          // Don't fail the plan update if resume fails - log and continue
        }
      }
    }

    // Validation: Cannot activate dynamic plan without a current price
    const finalStripePriceId = newStripePriceId || existingPlan.stripePriceId;
    if (
      data.status === "ACTIVE" &&
      existingPlan.pricingType === "DYNAMIC" &&
      !finalStripePriceId
    ) {
      return NextResponse.json(
        { error: "Cannot activate dynamic plan without setting a current price" },
        { status: 400 }
      );
    }

    // Update plan in database
    // Exclude interval/intervalCount (moved to Membership model) and monthlyPrices (not a DB field)
    const { interval, intervalCount, monthlyPrices, ...planUpdateData } = data;
    
    // Convert any remaining empty strings to null for Prisma
    const cleanedUpdateData = Object.fromEntries(
      Object.entries(planUpdateData).map(([key, value]) => [
        key,
        value === "" ? null : value
      ])
    );
    
    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        ...cleanedUpdateData,
        stripePriceId: finalStripePriceId,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: existingPlan.businessId,
        actorUserId: session.user.id,
        type: "PLAN_UPDATED",
        metadata: {
          planId: updatedPlan.id,
          planName: updatedPlan.name,
          changes: data,
          newStripePriceId: newStripePriceId,
        },
      },
    });

    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error("Update plan error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update plan", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// DELETE: Archive plan
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ planId: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { planId } = await context.params;

    // Get plan and verify access
    const plan = await prisma.plan.findFirst({
      where: {
        id: planId,
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
        _count: {
          select: {
            planSubscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Plan not found or access denied" },
        { status: 404 }
      );
    }

    // Don't allow deletion if there are active subscriptions
    if (plan._count.planSubscriptions > 0) {
      return NextResponse.json(
        { error: "Cannot delete plan with active subscriptions. Archive it instead." },
        { status: 400 }
      );
    }

    // Archive in Stripe (don't delete, for audit trail)
    if (plan.stripeProductId && plan.business.stripeAccountId) {
      const stripe = getStripeClient(plan.business.stripeAccountId);
      await stripe.products.update(plan.stripeProductId, {
        active: false,
      });
    }

    // Archive plan in database (soft delete)
    const archivedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        status: "ARCHIVED",
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId: plan.businessId,
        actorUserId: session.user.id,
        type: "PLAN_ARCHIVED",
        metadata: {
          planId: plan.id,
          planName: plan.name,
        },
      },
    });

    return NextResponse.json({
      message: "Plan archived successfully",
      plan: archivedPlan,
    });
  } catch (error) {
    console.error("Delete plan error:", error);
    return NextResponse.json(
      { error: "Failed to archive plan" },
      { status: 500 }
    );
  }
}

