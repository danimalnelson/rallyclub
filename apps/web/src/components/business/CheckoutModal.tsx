"use client";

import { Button, formatCurrency } from "@wine-club/ui";
import { X, Lock, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PaymentElement,
  AddressElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  basePrice: number | null;
  currency: string;
  interval: string;
  intervalCount: number;
  pricingType: string;
  setupFee: number | null;
  shippingFee: number | null;
  stockStatus: string;
}

interface Membership {
  name: string;
  description: string | null;
}

interface CheckoutFormProps {
  plan: Plan;
  membership: Membership;
  email: string;
  businessSlug: string;
  onSuccess: () => void;
  onClose: () => void;
}

function CheckoutForm({
  plan,
  membership,
  email,
  businessSlug,
  onSuccess,
  onClose,
}: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  
  const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const calculateTotal = () => {
    let total = plan.basePrice || 0;
    if (plan.setupFee) total += plan.setupFee;
    if (plan.shippingFee) total += plan.shippingFee;
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }

    if (!acceptedTerms) {
      setErrorMessage("Please accept the terms and conditions");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Confirm payment with Stripe
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      // Confirm the setup intent (for subscriptions)
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/${businessSlug}/success`,
          payment_method_data: {
            billing_details: {
              name: name,
              email: email,
            },
          },
        },
        redirect: "if_required",
      });

      if (error) {
        throw new Error(error.message);
      }

      if (setupIntent?.status === "succeeded") {
        // Create subscription on our backend
        const confirmRes = await fetch(
          `/api/checkout/${businessSlug}/${plan.id}/confirm`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              setupIntentId: setupIntent.id,
              paymentMethodId: setupIntent.payment_method,
              consumerEmail: email,
              consumerName: name,
            }),
          }
        );

        if (!confirmRes.ok) {
          const errorData = await confirmRes.json();
          throw new Error(errorData.error || "Failed to create subscription");
        }

        // Success!
        onSuccess();
        router.push(`/${businessSlug}/success`);
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMessage(err.message || "Payment failed. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Order Summary</h3>
        <div className="bg-accent/50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">
              {membership.name} - {plan.name}
            </span>
            <span className="text-sm font-medium">
              {plan.basePrice && formatCurrency(plan.basePrice, plan.currency)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Billed {plan.intervalCount > 1 && `every ${plan.intervalCount} `}
            {plan.interval.toLowerCase()}
            {plan.intervalCount > 1 && "s"}
          </div>
          
          {plan.setupFee && plan.setupFee > 0 && (
            <div className="flex justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">
                One-time setup fee
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(plan.setupFee, plan.currency)}
              </span>
            </div>
          )}
          
          {plan.shippingFee && plan.shippingFee > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Shipping</span>
              <span className="text-sm font-medium">
                {formatCurrency(plan.shippingFee, plan.currency)}
              </span>
            </div>
          )}

          <div className="flex justify-between pt-2 border-t font-semibold">
            <span>Total due today</span>
            <span>{formatCurrency(calculateTotal(), plan.currency)}</span>
          </div>
        </div>
      </div>

      {/* Customer Information */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Customer Information</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2 rounded-lg border border-input bg-muted text-muted-foreground cursor-not-allowed"
            />
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1">
              Full Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="John Doe"
              className="w-full px-4 py-2 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isProcessing}
            />
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Payment Details</h3>
        <PaymentElement />
      </div>

      {/* Billing Address */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Billing Address</h3>
        <AddressElement options={{ mode: "billing" }} />
      </div>

      {/* Terms & Conditions */}
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="terms"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1"
          disabled={isProcessing}
        />
        <label htmlFor="terms" className="text-sm text-muted-foreground">
          I agree to the terms and conditions and authorize recurring charges
          for this subscription
        </label>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{errorMessage}</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 text-base"
        disabled={!stripe || isProcessing || !acceptedTerms}
      >
        {isProcessing ? "Processing..." : "Complete Purchase"}
      </Button>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        <span>Secured by Stripe</span>
      </div>
    </form>
  );
}

interface CheckoutModalProps {
  plan: Plan;
  membership: Membership;
  businessSlug: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialEmail?: string;
  onEmailConfirm?: (email: string) => Promise<void>;
  skipEmailStep?: boolean; // If true, go directly to payment (Elements already initialized)
  onEditEmail?: () => void; // Callback to reset and go back to email step
}

export function CheckoutModal({
  plan,
  membership,
  businessSlug,
  isOpen,
  onClose,
  onSuccess,
  initialEmail = "",
  onEmailConfirm,
  skipEmailStep = false,
  onEditEmail,
}: CheckoutModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [emailConfirmed, setEmailConfirmed] = useState(skipEmailStep);
  const [isConfirmingEmail, setIsConfirmingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
      // Reset state when modal closes
      if (!isOpen) {
        setEmail(initialEmail);
        setEmailConfirmed(false);
        setIsConfirmingEmail(false);
        setEmailError(null);
      }
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const handleEmailConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsConfirmingEmail(true);
    setEmailError(null);

    try {
      // Call parent's email confirm handler to initialize SetupIntent
      if (onEmailConfirm) {
        await onEmailConfirm(email);
      }
      setEmailConfirmed(true);
    } catch (error) {
      console.error("Email confirmation error:", error);
      setEmailError("Failed to initialize checkout. Please try again.");
    } finally {
      setIsConfirmingEmail(false);
    }
  };

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
                      /{plan.intervalCount > 1 && `${plan.intervalCount} `}
                      {plan.interval.toLowerCase()}
                      {plan.intervalCount > 1 && "s"}
                    </span>
                  </div>
                  {plan.interval === "MONTH" &&
                    plan.intervalCount === 12 &&
                    plan.basePrice && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(
                          Math.round(plan.basePrice / 12),
                          plan.currency
                        )}
                        /month billed annually
                      </p>
                    )}
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
                      Billed every {plan.intervalCount > 1 && `${plan.intervalCount} `}
                      {plan.interval.toLowerCase()}
                      {plan.intervalCount > 1 && "s"}
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

          {/* RIGHT COLUMN - Email or Payment */}
          <div className="p-8 md:p-10">
            <div className="max-w-md mx-auto">
              {!emailConfirmed ? (
                /* Email Step */
                <div>
                  <h3 className="text-xl font-semibold mb-2">Enter Your Email</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    We'll send your subscription details and login information here
                  </p>

                  <form onSubmit={handleEmailConfirm} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium mb-2">
                        Email address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                        autoFocus
                        disabled={isConfirmingEmail}
                      />
                    </div>

                    {emailError && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p className="text-sm text-destructive">{emailError}</p>
                      </div>
                    )}

                    <Button type="submit" className="w-full h-12 text-base" disabled={!email || isConfirmingEmail}>
                      {isConfirmingEmail ? "Initializing..." : "Continue to Payment"}
                    </Button>

                    <p className="text-center text-xs text-muted-foreground">
                      By continuing, you agree to receive subscription updates and can unsubscribe at any time
                    </p>
                  </form>
                </div>
              ) : (
                /* Payment Step */
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold mb-2">Complete Your Purchase</h3>
                      <p className="text-sm text-muted-foreground">
                        Subscribing as: <span className="font-medium text-foreground">{email}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (skipEmailStep && onEditEmail) {
                          // If we're in the second modal with Elements, need to reset parent state
                          onEditEmail();
                        } else {
                          // If we're in the first modal, just go back
                          setEmailConfirmed(false);
                          setEmailError(null);
                        }
                      }}
                      className="text-sm text-primary hover:underline shrink-0 ml-4"
                    >
                      Edit email
                    </button>
                  </div>

                  <CheckoutForm
                    plan={plan}
                    membership={membership}
                    email={email}
                    businessSlug={businessSlug}
                    onSuccess={onSuccess}
                    onClose={onClose}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

