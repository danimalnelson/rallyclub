import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@wine-club/lib";

/**
 * GET /api/admin/test-clocks/[id]/details
 * Get full details for a test clock including customers, subscriptions, invoices, and events
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Get test clock
    const testClock = await stripe.testHelpers.testClocks.retrieve(id);

    // Find customers attached to this test clock
    const customers = await stripe.customers.list({
      limit: 10,
    });

    // Filter to customers with this test clock
    const clockCustomers = customers.data.filter(
      (c) => c.test_clock === id
    );

    // Get subscriptions and invoices for each customer
    const customerDetails = await Promise.all(
      clockCustomers.map(async (customer) => {
        const [subscriptions, invoices] = await Promise.all([
          stripe.subscriptions.list({ customer: customer.id, limit: 10 }),
          stripe.invoices.list({ customer: customer.id, limit: 20 }),
        ]);

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          metadata: customer.metadata,
          subscriptions: subscriptions.data.map((sub) => ({
            id: sub.id,
            status: sub.status,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            trialStart: sub.trial_start,
            trialEnd: sub.trial_end,
            billingCycleAnchor: sub.billing_cycle_anchor,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            created: sub.created,
            description: sub.description,
            metadata: sub.metadata,
          })),
          invoices: invoices.data.map((inv) => ({
            id: inv.id,
            number: inv.number,
            status: inv.status,
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            currency: inv.currency,
            created: inv.created,
            dueDate: inv.due_date,
            periodStart: inv.period_start,
            periodEnd: inv.period_end,
            billingReason: inv.billing_reason,
            paid: inv.paid,
          })),
        };
      })
    );

    // Get recent events related to this test clock's customers
    const allEvents: any[] = [];
    for (const customer of clockCustomers) {
      const events = await stripe.events.list({
        limit: 50,
        types: [
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "customer.subscription.trial_will_end",
          "invoice.created",
          "invoice.finalized",
          "invoice.paid",
          "invoice.payment_failed",
          "payment_intent.succeeded",
          "payment_intent.payment_failed",
        ],
      });

      // Filter events for this customer
      const customerEvents = events.data.filter((event) => {
        const data = event.data.object as any;
        return data.customer === customer.id;
      });

      allEvents.push(...customerEvents);
    }

    // Sort events by created time
    allEvents.sort((a, b) => b.created - a.created);

    return NextResponse.json({
      testClock: {
        id: testClock.id,
        name: testClock.name,
        frozenTime: testClock.frozen_time,
        frozenTimeFormatted: new Date(testClock.frozen_time * 1000).toISOString(),
        status: testClock.status,
        created: testClock.created,
      },
      customers: customerDetails,
      events: allEvents.slice(0, 50).map((event) => ({
        id: event.id,
        type: event.type,
        created: event.created,
        createdFormatted: new Date(event.created * 1000).toISOString(),
        data: summarizeEventData(event),
      })),
    });
  } catch (error: any) {
    console.error("[Test Clock Details] Error:", error);
    return NextResponse.json(
      { error: "Failed to get test clock details", details: error.message },
      { status: 500 }
    );
  }
}

function summarizeEventData(event: any): any {
  const obj = event.data.object;
  
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return {
        subscriptionId: obj.id,
        status: obj.status,
        currentPeriodEnd: obj.current_period_end,
      };
    case "invoice.created":
    case "invoice.finalized":
    case "invoice.paid":
    case "invoice.payment_failed":
      return {
        invoiceId: obj.id,
        status: obj.status,
        amountDue: obj.amount_due,
        billingReason: obj.billing_reason,
      };
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
      return {
        paymentIntentId: obj.id,
        amount: obj.amount,
        status: obj.status,
      };
    default:
      return { id: obj.id };
  }
}
