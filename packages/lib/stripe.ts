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

  if (params.applicationFeeAmount) {
    sessionParams.payment_intent_data = {
      application_fee_amount: params.applicationFeeAmount,
    };
    sessionParams.subscription_data = {
      application_fee_percent: undefined, // Use fixed fee instead
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

