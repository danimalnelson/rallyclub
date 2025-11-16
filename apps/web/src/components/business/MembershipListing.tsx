"use client";

import { Button, Card, formatCurrency } from "@wine-club/ui";
import { Check } from "lucide-react";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { CheckoutModal } from "./CheckoutModal";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  currency: string;
  interval: string;
  intervalCount: number;
  pricingType: string;
  shippingFee: number | null;
  setupFee: number | null;
  stockStatus: string;
}

interface Membership {
  id: string;
  name: string;
  description: string | null;
  plans: Plan[];
}

interface MembershipListingProps {
  businessName: string;
  businessSlug: string;
  businessDescription?: string;
  memberships: Membership[];
}

export function MembershipListing({
  businessName,
  businessSlug,
  businessDescription,
  memberships,
}: MembershipListingProps) {
  const [selectedPlan, setSelectedPlan] = useState<{
    plan: Plan;
    membership: Membership;
  } | null>(null);
  
  const [confirmedEmail, setConfirmedEmail] = useState<string>("");
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [isInitializingCheckout, setIsInitializingCheckout] = useState(false);

  if (memberships.length === 0) {
    return (
      <div className="text-center py-12">
        <Card className="p-6 md:p-8 max-w-md mx-auto">
          <p className="text-sm text-muted-foreground">
            No membership plans available at this time. Check back soon!
          </p>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Business info section */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {businessDescription && (
          <div className="pb-8 md:pb-10">
            <h2 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4 text-balance">
              About {businessName}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-3xl text-pretty">
              {businessDescription}
            </p>
          </div>
        )}
      </div>

      {/* Memberships section - full width gray background */}
      <div className="bg-gray-50 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="space-y-10 md:space-y-12">
          {memberships.map((membership) => (
            <div
              key={membership.id}
              className="pb-10 md:pb-12 last:pb-0"
            >
              <div className="mb-6 md:mb-8">
                <h3 className="text-lg md:text-xl font-semibold mb-2 text-balance">
                  {membership.name}
                </h3>
                {membership.description && (
                  <p className="text-sm text-muted-foreground text-pretty">
                    {membership.description}
                  </p>
                )}
              </div>

            {/* Plans grid */}
            {membership.plans.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No plans available in this membership.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {membership.plans.map((plan) => (
                  <Card
                    key={plan.id}
                    className="relative bg-white border-0 shadow-none rounded-2xl p-5 md:p-6 pb-20 hover:scale-[1.01] transition-transform duration-300 ease-out"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold mb-1 truncate">{plan.name}</h4>
                        {plan.pricingType === "FIXED" && plan.basePrice ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-semibold tracking-tight">
                              {formatCurrency(plan.basePrice, plan.currency)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              /{plan.intervalCount > 1 && `${plan.intervalCount} `}
                              {plan.interval.toLowerCase()}
                              {plan.intervalCount > 1 && "s"}
                            </span>
                          </div>
                        ) : (
                          <div className="text-lg font-semibold text-muted-foreground">
                            Dynamic Pricing
                          </div>
                        )}
                      </div>
                      
                      {/* Stock Status Badge */}
                      {plan.stockStatus !== "AVAILABLE" && (
                        <div className="shrink-0 ml-2">
                          {plan.stockStatus === "SOLD_OUT" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                              Sold Out
                            </span>
                          )}
                          {plan.stockStatus === "WAITLIST" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Waitlist
                            </span>
                          )}
                          {plan.stockStatus === "COMING_SOON" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              Coming Soon
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {plan.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {plan.description}
                      </p>
                    )}

                    {/* Plan features/details */}
                    <ul className="space-y-3 mb-6">
                      <li className="flex gap-3 text-sm">
                        <Check className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">
                          Billed every {plan.intervalCount > 1 && `${plan.intervalCount} `}
                          {plan.interval.toLowerCase()}
                          {plan.intervalCount > 1 && "s"}
                        </span>
                      </li>
                      {plan.shippingFee && plan.shippingFee > 0 && (
                        <li className="flex gap-3 text-sm">
                          <Check className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">
                            + {formatCurrency(plan.shippingFee, plan.currency)} shipping
                          </span>
                        </li>
                      )}
                      {plan.setupFee && plan.setupFee > 0 && (
                        <li className="flex gap-3 text-sm">
                          <Check className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">
                            {formatCurrency(plan.setupFee, plan.currency)} one-time setup fee
                          </span>
                        </li>
                      )}
                    </ul>

                    <Button
                      className="absolute bottom-5 right-5 rounded-full h-10 px-6"
                      onClick={() => setSelectedPlan({ plan, membership })}
                      disabled={
                        plan.stockStatus === "SOLD_OUT" ||
                        plan.stockStatus === "COMING_SOON"
                      }
                    >
                      {plan.stockStatus === "SOLD_OUT"
                        ? "Sold Out"
                        : plan.stockStatus === "COMING_SOON"
                        ? "Coming Soon"
                        : plan.stockStatus === "WAITLIST"
                        ? "Join Waitlist"
                        : "Subscribe"}
                    </Button>
                  </Card>
                ))}
              </div>
            )}
            </div>
          ))}
          </div>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="pt-8 md:pt-10 text-sm text-muted-foreground max-w-2xl">
          <p className="mb-4 text-pretty">
            All memberships can be canceled anytime. No long-term commitment required.
          </p>
          <p className="text-pretty">
            Questions? Contact us at{" "}
            <a
              href={`mailto:support@${businessSlug}.com`}
              className="underline hover:text-foreground transition-colors"
            >
              support@{businessSlug}.com
            </a>
          </p>
        </div>
      </div>

      {/* Combined Checkout Modal */}
      {selectedPlan && !clientSecret && (
        <CheckoutModal
          plan={selectedPlan.plan}
          membership={selectedPlan.membership}
          businessSlug={businessSlug}
          isOpen={true}
          onClose={() => {
            setSelectedPlan(null);
            setConfirmedEmail("");
            setStripePromise(null);
            setClientSecret("");
          }}
          onSuccess={() => {
            setSelectedPlan(null);
            setConfirmedEmail("");
            setStripePromise(null);
            setClientSecret("");
          }}
          onEmailConfirm={async (email) => {
            // Store confirmed email
            setConfirmedEmail(email);
            
            // Initialize SetupIntent with email to ensure customer consolidation
            const [configRes, setupRes] = await Promise.all([
              fetch(`/api/portal/${businessSlug}/stripe-config`),
              fetch(`/api/checkout/${businessSlug}/${selectedPlan.plan.id}/setup-intent`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ consumerEmail: email }),
              }),
            ]);

            if (!configRes.ok || !setupRes.ok) {
              throw new Error("Failed to initialize checkout");
            }

            const config = await configRes.json();
            const setup = await setupRes.json();

            // Initialize Stripe
            const stripe = await loadStripe(config.publishableKey, {
              stripeAccount: config.stripeAccount,
            });

            setStripePromise(Promise.resolve(stripe));
            setClientSecret(setup.clientSecret);
          }}
        />
      )}

      {/* Checkout Modal with Payment Elements */}
      {selectedPlan && clientSecret && stripePromise && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "rgb(38 38 38)",
                borderRadius: "0.75rem",
              },
            },
          }}
        >
          <CheckoutModal
            plan={selectedPlan.plan}
            membership={selectedPlan.membership}
            businessSlug={businessSlug}
            isOpen={true}
            skipEmailStep={true}
            initialEmail={confirmedEmail}
            onClose={() => {
              setSelectedPlan(null);
              setConfirmedEmail("");
              setStripePromise(null);
              setClientSecret("");
            }}
            onSuccess={() => {
              setSelectedPlan(null);
              setConfirmedEmail("");
              setStripePromise(null);
              setClientSecret("");
            }}
            onEditEmail={() => {
              // Reset to email step
              setConfirmedEmail("");
              setStripePromise(null);
              setClientSecret("");
            }}
          />
        </Elements>
      )}
    </>
  );
}

