import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@wine-club/lib";

type ScenarioType = "rolling" | "cohort-immediate" | "cohort-deferred";

/**
 * Calculate the next 1st of month as Unix timestamp
 */
function getNextFirstOfMonth(fromDate: Date = new Date()): number {
  const next = new Date(fromDate);
  next.setMonth(next.getMonth() + 1);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return Math.floor(next.getTime() / 1000);
}

/**
 * POST /api/admin/test-clocks/scenarios/[type]/run
 * Run a specific billing scenario
 * 
 * Types:
 * - rolling: Immediate billing, anniversary-based renewal
 * - cohort-immediate: Charge now, align to 1st of month
 * - cohort-deferred: Trial until 1st, then first charge
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ type: string }> }
) {
  // Check Stripe configuration first
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || stripeKey.includes('placeholder')) {
    return NextResponse.json(
      { error: "Stripe not configured", details: "STRIPE_SECRET_KEY environment variable is missing or invalid" },
      { status: 500 }
    );
  }
  
  try {
    const { type } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { priceId, startDate } = body;

    // Validate scenario type
    const validTypes: ScenarioType[] = ["rolling", "cohort-immediate", "cohort-deferred"];
    if (!validTypes.includes(type as ScenarioType)) {
      return NextResponse.json(
        { error: `Invalid scenario type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Use provided start date or current time
    const frozenTime = startDate
      ? Math.floor(new Date(startDate).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    const scenarioType = type as ScenarioType;

    // 1. Create test clock
    const testClock = await stripe.testHelpers.testClocks.create({
      frozen_time: frozenTime,
      name: `Scenario: ${scenarioType} - ${new Date(frozenTime * 1000).toISOString().split("T")[0]}`,
    });

    // 2. Create test customer attached to clock
    const customer = await stripe.customers.create({
      email: `test-${scenarioType}-${Date.now()}@scenario.test`,
      name: `Test Customer (${scenarioType})`,
      test_clock: testClock.id,
      metadata: {
        scenarioType,
        testClock: testClock.id,
      },
    });

    // 3. Attach a test payment method to the customer
    const paymentMethod = await stripe.paymentMethods.attach("pm_card_visa", {
      customer: customer.id,
    });

    // Set as default payment method
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethod.id,
      },
    });

    // 4. Create or get a test price
    let effectivePriceId = priceId;
    
    if (!effectivePriceId) {
      // Create a test product and price
      const product = await stripe.products.create({
        name: `Test Membership (${scenarioType})`,
        metadata: { testClock: testClock.id, scenarioType },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: 1000, // $10.00
        currency: "usd",
        recurring: { interval: "month" },
        nickname: `Test Price - ${scenarioType}`,
      });

      effectivePriceId = price.id;
    }

    // 5. Create subscription based on scenario type
    let subscriptionParams: any = {
      customer: customer.id,
      items: [{ price: effectivePriceId }],
      metadata: {
        scenarioType,
        testClock: testClock.id,
      },
    };

    const frozenDate = new Date(frozenTime * 1000);
    const nextFirst = getNextFirstOfMonth(frozenDate);

    switch (scenarioType) {
      case "rolling":
        // No special params - bills immediately, renews on signup anniversary
        subscriptionParams.description = "Rolling: Bills on signup anniversary";
        break;

      case "cohort-immediate":
        // Charge now, but align future billing to 1st of month
        subscriptionParams.billing_cycle_anchor = nextFirst;
        subscriptionParams.proration_behavior = "none";
        subscriptionParams.description = "Cohort Immediate: Charge now, next bill on 1st";
        break;

      case "cohort-deferred":
        // Trial until 1st, then first charge
        subscriptionParams.trial_end = nextFirst;
        subscriptionParams.billing_cycle_anchor_config = {
          day_of_month: 1,
        };
        subscriptionParams.description = "Cohort Deferred: Trial until 1st, then bill";
        break;
    }

    const subscription = await stripe.subscriptions.create(subscriptionParams);

    // 6. Get initial invoice info
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 5,
    });

    return NextResponse.json({
      success: true,
      scenario: {
        type: scenarioType,
        description: getScenarioDescription(scenarioType),
      },
      testClock: {
        id: testClock.id,
        name: testClock.name,
        frozenTime: testClock.frozen_time,
        frozenTimeFormatted: new Date(testClock.frozen_time * 1000).toISOString(),
      },
      customer: {
        id: customer.id,
        email: customer.email,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        trialEnd: subscription.trial_end,
        billingCycleAnchor: subscription.billing_cycle_anchor,
      },
      invoices: invoices.data.map((inv) => ({
        id: inv.id,
        status: inv.status,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        created: inv.created,
        dueDate: inv.due_date,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
      })),
      nextSteps: getNextSteps(scenarioType, testClock.frozen_time, nextFirst),
    });
  } catch (error: any) {
    console.error("[Scenario Run] Error:", error.message);
    return NextResponse.json(
      { 
        error: "Failed to run scenario", 
        details: error.message,
        stripeError: {
          type: error.type,
          code: error.code,
          statusCode: error.statusCode,
        }
      },
      { status: 500 }
    );
  }
}

function getScenarioDescription(type: ScenarioType): string {
  switch (type) {
    case "rolling":
      return "Member is charged immediately. Future billing occurs on the same day each month (signup anniversary).";
    case "cohort-immediate":
      return "Member is charged immediately. Future billing aligns to the 1st of each month (cohort billing).";
    case "cohort-deferred":
      return "Member gets a trial until the 1st of the month. First charge occurs on the 1st, then monthly thereafter.";
  }
}

function getNextSteps(type: ScenarioType, currentTime: number, nextFirst: number): string[] {
  const daysUntilFirst = Math.ceil((nextFirst - currentTime) / 86400);
  
  switch (type) {
    case "rolling":
      return [
        "Advance time by 30 days to trigger first renewal",
        "Advance time by 60 days to see second renewal",
        "Check invoices list to verify billing dates",
      ];
    case "cohort-immediate":
      return [
        `Advance time by ${daysUntilFirst} days to reach the 1st`,
        "Check that second invoice is created on the 1st",
        "Advance another month to verify cohort alignment",
      ];
    case "cohort-deferred":
      return [
        `Advance time by ${daysUntilFirst} days to end trial on the 1st`,
        "Check that first invoice is created when trial ends",
        "Advance another month to verify regular billing",
      ];
  }
}
