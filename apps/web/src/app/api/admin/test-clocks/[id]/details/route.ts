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

    // Get test clock - may need to wait if still advancing
    let testClock = await stripe.testHelpers.testClocks.retrieve(id);
    
    // Wait if clock is still advancing
    let retries = 0;
    while (testClock.status === "advancing" && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      testClock = await stripe.testHelpers.testClocks.retrieve(id);
      retries++;
    }

    // Find customers attached to this test clock by searching metadata
    let clockCustomers: any[] = [];
    
    try {
      const searchResults = await stripe.customers.search({
        query: `metadata["testClock"]:"${id}"`,
        limit: 10,
      });
      clockCustomers = searchResults.data;
    } catch (searchError: any) {
      // Search might fail, use fallback
    }
    
    // Fallback: also try listing and filtering if search returns nothing
    if (clockCustomers.length === 0) {
      const allCustomers = await stripe.customers.list({
        limit: 100,
      });
      
      clockCustomers = allCustomers.data.filter((c: any) => {
        return c.metadata?.testClock === id;
      });
    }

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
    try {
      const events = await stripe.events.list({
        limit: 100,
      });
      
      const customerIds = clockCustomers.map(c => c.id);
      
      for (const event of events.data) {
        const data = event.data.object as any;
        // Check if event is related to our customers
        if (data.customer && customerIds.includes(data.customer)) {
          allEvents.push(event);
        }
        // Also check for subscription events that might have customer nested
        else if (data.customer_id && customerIds.includes(data.customer_id)) {
          allEvents.push(event);
        }
        // Check for invoice events where customer might be an object
        else if (typeof data.customer === 'object' && data.customer?.id && customerIds.includes(data.customer.id)) {
          allEvents.push(event);
        }
        // Check subscription field for customer
        else if (data.subscription && typeof data.subscription === 'object' && data.subscription.customer && customerIds.includes(data.subscription.customer)) {
          allEvents.push(event);
        }
      }
    } catch (eventsError: any) {
      // Continue without events
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
    console.error("[Test Clock Details] Error:", error.message);
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
