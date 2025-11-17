"use client";

import { Button, formatCurrency } from "@wine-club/ui";
import { X, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  setupFee: number | null;
  shippingFee: number | null;
  currency: string;
  pricingType: string;
}

interface Membership {
  name: string;
  description: string | null;
  billingInterval: string;
}

interface CheckoutModalProps {
  plan: Plan;
  membership: Membership;
  businessSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckoutModal({
  plan,
  membership,
  businessSlug,
  isOpen,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const router = useRouter();
  const [stripePromise, setStripePromise] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      
      // Initialize Stripe when modal opens
      const initStripe = async () => {
        const configRes = await fetch(`/api/portal/${businessSlug}/stripe-config`);
        const config = await configRes.json();

        const stripe = await loadStripe(config.publishableKey, {
          stripeAccount: config.stripeAccount,
        });

        setStripePromise(stripe);
      };

      initStripe();
    } else {
      document.body.style.overflow = "unset";
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, businessSlug]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 ease-out" />

      {/* Modal - Two Column Layout */}
      <div
        className="relative bg-background rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-accent transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* LEFT COLUMN - Plan Details */}
          <div className="p-8 md:p-10 bg-accent/30 border-r border-border">
            <div className="max-w-md mx-auto lg:mx-0">
              <p className="text-sm text-muted-foreground mb-2">{membership.name}</p>
              <h2 className="text-2xl md:text-3xl font-semibold mb-4 text-balance">
                {plan.name}
              </h2>
              
              {membership.description && (
                <p className="text-sm text-muted-foreground mb-6 text-pretty">
                  {membership.description}
                </p>
              )}

              {/* Pricing */}
              {plan.pricingType === "FIXED" && plan.basePrice ? (
                <div className="bg-background/80 rounded-lg p-6 mb-6">
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-semibold tracking-tight">
                      {formatCurrency(plan.basePrice, plan.currency)}
                    </span>
                    <span className="text-lg text-muted-foreground">
                      /{membership.billingInterval.toLowerCase()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-background/80 rounded-lg p-6 mb-6">
                  <div className="text-2xl font-semibold mb-2">Dynamic Pricing</div>
                  <p className="text-sm text-muted-foreground">
                    Price varies by selection
                  </p>
                </div>
              )}

              {/* Plan Description */}
              {plan.description && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3">About this plan</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {plan.description}
                  </p>
                </div>
              )}

              {/* Features */}
              <div className="mb-6">
                <h3 className="font-semibold mb-4">What's included</h3>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-sm">
                    <Check className="w-5 h-5 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      Billed {membership.billingInterval.toLowerCase()}ly
                    </span>
                  </li>
                  {plan.shippingFee && plan.shippingFee > 0 && (
                    <li className="flex gap-3 text-sm">
                      <Check className="w-5 h-5 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        {formatCurrency(plan.shippingFee, plan.currency)} shipping per
                        delivery
                      </span>
                    </li>
                  )}
                  {plan.setupFee && plan.setupFee > 0 && (
                    <li className="flex gap-3 text-sm">
                      <Check className="w-5 h-5 shrink-0 mt-0.5" />
                      <span className="leading-relaxed">
                        {formatCurrency(plan.setupFee, plan.currency)} one-time setup
                        fee
                      </span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Additional info */}
              <div className="bg-background/80 rounded-lg p-4">
                <h3 className="font-semibold mb-3 text-sm">Good to know</h3>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  <li>• Cancel anytime with no fees</li>
                  <li>• Access starts immediately after purchase</li>
                  <li>• Benefits reset on your billing date</li>
                  <li>• Manage your subscription from the member portal</li>
                </ul>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - Embedded Checkout */}
          <div className="p-8 md:p-10">
            {stripePromise ? (
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret: async () => {
                    const res = await fetch(
                      `/api/checkout/${businessSlug}/${plan.id}/session`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                      }
                    );
                    const data = await res.json();
                    
                    if (!res.ok || !data.clientSecret) {
                      console.error("Failed to create checkout session:", data);
                      throw new Error(data.error || "Failed to initialize checkout");
                    }
                    
                    return data.clientSecret;
                  },
                  onComplete: () => {
                    onSuccess();
                    router.push(`/${businessSlug}/success`);
                  },
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                <p className="text-sm text-muted-foreground">Loading checkout...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
