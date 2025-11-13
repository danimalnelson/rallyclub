import Stripe from "stripe";

// Base Stripe client (platform)
// Use a placeholder key during build to avoid errors
const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_for_build";

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16",
  typescript: true,
});

/**
 * Get a Stripe client for a specific connected account
 */
export function getStripeClient(accountId?: string): Stripe {
  if (!accountId) {
    return stripe;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2023-10-16",
    typescript: true,
    stripeAccount: accountId,
  });
}

/**
 * Ensure a Stripe Customer exists on the connected account for the given consumer
 */
export async function ensureCustomerOnConnectedAccount(
  consumer: { id: string; email: string; name?: string | null },
  accountId: string
): Promise<string> {
  const client = getStripeClient(accountId);

  // In production, you'd store the Stripe customer ID per account in your DB
  // For now, search for existing customer by email
  const existingCustomers = await client.customers.list({
    email: consumer.email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0].id;
  }

  // Create new customer
  const customer = await client.customers.create({
    email: consumer.email,
    name: consumer.name || undefined,
    metadata: {
      consumerId: consumer.id,
    },
  });

  return customer.id;
}

/**
 * Create a Checkout Session on a connected account
 * 
 * @param billingCycleAnchor - Unix timestamp for cohort billing (NEXT_INTERVAL memberships)
 * @param trialPeriodDays - Number of days for trial period
 */
export async function createConnectedCheckoutSession(params: {
  accountId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerId?: string;
  applicationFeeAmount?: number;
  allowPromotionCodes?: boolean;
  automaticTax?: boolean;
  metadata?: Record<string, string>;
  billingCycleAnchor?: number; // NEW: Unix timestamp for cohort billing
  trialPeriodDays?: number; // NEW: Trial period
}): Promise<Stripe.Checkout.Session> {
  const client = getStripeClient(params.accountId);

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: params.allowPromotionCodes ?? false,
    metadata: params.metadata,
  };

  if (params.customerId) {
    sessionParams.customer = params.customerId;
  } else {
    sessionParams.customer_creation = "always";
  }

  // Configure subscription data
  sessionParams.subscription_data = {
    ...(params.applicationFeeAmount && {
      application_fee_percent: undefined, // Use fixed fee instead
    }),
  };

  // NEW: Add billing cycle anchor for cohort billing (NEXT_INTERVAL)
  if (params.billingCycleAnchor) {
    sessionParams.subscription_data.billing_cycle_anchor = params.billingCycleAnchor;
    sessionParams.subscription_data.proration_behavior = "none"; // Don't prorate for cohort billing
  }

  // NEW: Add trial period
  if (params.trialPeriodDays) {
    sessionParams.subscription_data.trial_period_days = params.trialPeriodDays;
  }

  if (params.applicationFeeAmount) {
    sessionParams.payment_intent_data = {
      application_fee_amount: params.applicationFeeAmount,
    };
  }

  if (params.automaticTax) {
    sessionParams.automatic_tax = { enabled: true };
  }

  const session = await client.checkout.sessions.create(sessionParams);
  return session;
}

/**
 * Create a Customer Portal link
 */
export async function createCustomerPortalLink(params: {
  accountId: string;
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const client = getStripeClient(params.accountId);

  const session = await client.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

/**
 * Create a Stripe Product on a connected account
 */
export async function createConnectedProduct(
  accountId: string,
  params: {
    name: string;
    description?: string;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.Product> {
  const client = getStripeClient(accountId);
  return client.products.create(params);
}

/**
 * Create a Stripe Price on a connected account
 */
export async function createConnectedPrice(
  accountId: string,
  params: {
    productId: string;
    unitAmount: number;
    currency: string;
    interval: "month" | "year";
    nickname?: string;
    trialPeriodDays?: number;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.Price> {
  const client = getStripeClient(accountId);
  return client.prices.create({
    product: params.productId,
    unit_amount: params.unitAmount,
    currency: params.currency,
    recurring: {
      interval: params.interval,
      trial_period_days: params.trialPeriodDays,
    },
    nickname: params.nickname,
    metadata: params.metadata,
  });
}

/**
 * Create an Account Link for Connect onboarding
 */
export async function createAccountLink(params: {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  type?: "account_onboarding" | "account_update";
}): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: params.type || "account_onboarding",
  });

  return accountLink.url;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Pause a subscription (stop billing, keep access)
 * 
 * @param accountId - Connected account ID
 * @param subscriptionId - Stripe subscription ID
 * @returns Updated subscription
 */
export async function pauseSubscription(
  accountId: string,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const client = getStripeClient(accountId);
  
  return client.subscriptions.update(subscriptionId, {
    pause_collection: {
      behavior: "void", // Don't charge, keep subscription active
    },
  });
}

/**
 * Resume a paused subscription
 * 
 * @param accountId - Connected account ID
 * @param subscriptionId - Stripe subscription ID
 * @returns Updated subscription
 */
export async function resumeSubscription(
  accountId: string,
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const client = getStripeClient(accountId);
  
  return client.subscriptions.update(subscriptionId, {
    pause_collection: "", // Remove pause (empty string required by Stripe)
  });
}

/**
 * Calculate next cohort billing date for NEXT_INTERVAL memberships
 * 
 * @param cohortDay - Day of month (1-31)
 * @param signupDate - Date of signup (defaults to now)
 * @returns Unix timestamp for next billing cycle
 */
export function calculateNextCohortDate(
  cohortDay: number,
  signupDate: Date = new Date()
): number {
  const now = signupDate;
  const currentDay = now.getDate();
  
  // Determine next month to start billing
  let targetMonth = now.getMonth();
  let targetYear = now.getFullYear();
  
  // If signup is ON the billing day, start NEXT interval
  // If signup is AFTER billing day, start next month
  if (currentDay >= cohortDay) {
    targetMonth += 1;
    if (targetMonth > 11) {
      targetMonth = 0;
      targetYear += 1;
    }
  }
  
  // Create date for target month
  const targetDate = new Date(targetYear, targetMonth, cohortDay, 0, 0, 0, 0);
  
  // Handle edge case: if cohortDay > days in target month (e.g., Feb 31)
  // JavaScript Date will overflow to next month, which is correct behavior
  
  return Math.floor(targetDate.getTime() / 1000);
}

