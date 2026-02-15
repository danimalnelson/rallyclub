"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import Link from "next/link";
import { Pause, Play, Plus, CreditCard } from "geist-icons";
import { Cross } from "@/components/icons/Cross";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { PaymentMethodForm } from "@/components/portal/PaymentMethodForm";
import { PaymentMethodList } from "@/components/portal/PaymentMethodList";

interface StripeDetails {
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  trialEnd: string | null;
  paymentMethod?: {
    brand?: string;
    last4?: string;
  } | null;
}

interface Subscription {
  id: string;
  status: string;
  stripeSubscriptionId: string | null;
  plan: {
    id: string;
    name: string;
    basePrice: number | null;
    currency: string;
    membership: {
      name: string;
      billingInterval: string;
    };
  };
  stripeDetails: StripeDetails | null;
}

export default function MemberPortalPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [memberData, setMemberData] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<{ brand?: string; last4?: string } | null>(null);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<Array<{
    id: string;
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
    isDefault?: boolean;
  }>>([]);
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState<string | null>(null);

  useEffect(() => {
    // Check if consumer is authenticated and fetch subscriptions
    Promise.all([
      fetch(`/api/consumer/auth/session`),
      fetch(`/api/portal/${params.slug}/subscriptions`)
    ])
      .then(async ([sessionRes, subsRes]) => {
        if (!sessionRes.ok) {
          throw new Error("Not authenticated");
        }
        const sessionData = await sessionRes.json();
        const subsData = subsRes.ok ? await subsRes.json() : { subscriptions: [] };
        
        setAuthenticated(true);
        setMemberData(sessionData);
        setSubscriptions(subsData.subscriptions || []);
        
        // Extract default payment method from the first subscription
        const firstSubWithPayment = (subsData.subscriptions || []).find(
          (sub: Subscription) => sub.stripeDetails?.paymentMethod
        );
        if (firstSubWithPayment?.stripeDetails?.paymentMethod) {
          setDefaultPaymentMethod(firstSubWithPayment.stripeDetails.paymentMethod);
        }
        
        setLoading(false);
      })
      .catch(() => {
        // Redirect to sign-in
        router.push(`/${params.slug}/auth/signin?returnUrl=${encodeURIComponent(`/${params.slug}/portal`)}`);
      });
  }, [params.slug, router]);

  // Load Stripe configuration
  useEffect(() => {
    if (!params.slug) return;

    fetch(`/api/portal/${params.slug}/stripe-config`)
      .then((res) => res.json())
      .then((data) => {
        if (data.publishableKey) {
          setStripePromise(loadStripe(data.publishableKey, {
            stripeAccount: data.stripeAccount,
          }));
        }
      })
      .catch((err) => {
        console.error("Failed to load Stripe config:", err);
      });
  }, [params.slug]);

  // Fetch payment methods when authenticated
  useEffect(() => {
    if (!memberData?.email || !params.slug) return;

    fetchPaymentMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberData?.email, params.slug]);

  const fetchPaymentMethods = async () => {
    if (!memberData?.email) return;

    try {
      const res = await fetch(
        `/api/portal/${params.slug}/payment-methods?email=${encodeURIComponent(memberData.email)}`
      );

      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.paymentMethods);
        setDefaultPaymentMethodId(data.defaultPaymentMethodId);
      }
    } catch (err) {
      console.error("Failed to fetch payment methods:", err);
    }
  };

  const fetchSetupIntent = async () => {
    if (!memberData?.email) return;

    try {
      const res = await fetch(`/api/portal/${params.slug}/payment-methods/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberData.email }),
      });

      if (res.ok) {
        const data = await res.json();
        setClientSecret(data.clientSecret);
      }
    } catch (err) {
      console.error("Failed to fetch setup intent:", err);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      const res = await fetch(`/api/portal/${params.slug}/payment-methods/set-default`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: memberData?.email, paymentMethodId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set default");
      }

      // Refresh payment methods and subscriptions
      await fetchPaymentMethods();
      
      // Refresh subscriptions to get updated payment method
      const subsRes = await fetch(`/api/portal/${params.slug}/subscriptions`);
      const subsData = await subsRes.json();
      setSubscriptions(subsData.subscriptions || []);
      
      const firstSubWithPayment = (subsData.subscriptions || []).find(
        (sub: Subscription) => sub.stripeDetails?.paymentMethod
      );
      if (firstSubWithPayment?.stripeDetails?.paymentMethod) {
        setDefaultPaymentMethod(firstSubWithPayment.stripeDetails.paymentMethod);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to set default payment method");
    }
  };

  const handleRemove = async (paymentMethodId: string) => {
    if (!confirm("Are you sure you want to remove this payment method?")) {
      return;
    }

    try {
      const res = await fetch(
        `/api/portal/${params.slug}/payment-methods/${paymentMethodId}?email=${encodeURIComponent(memberData?.email || '')}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove");
      }

      await fetchPaymentMethods();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove payment method");
    }
  };

  const handlePaymentMethodAdded = async () => {
    await fetchSetupIntent();
    await fetchPaymentMethods();
    setShowAddPaymentMethod(false);
    
    // Refresh subscriptions to get updated payment method
    const subsRes = await fetch(`/api/portal/${params.slug}/subscriptions`);
    const subsData = await subsRes.json();
    setSubscriptions(subsData.subscriptions || []);
    
    const firstSubWithPayment = (subsData.subscriptions || []).find(
      (sub: Subscription) => sub.stripeDetails?.paymentMethod
    );
    if (firstSubWithPayment?.stripeDetails?.paymentMethod) {
      setDefaultPaymentMethod(firstSubWithPayment.stripeDetails.paymentMethod);
    }
  };

  const handleShowAddPaymentMethod = () => {
    setShowAddPaymentMethod(true);
    fetchSetupIntent();
  };

  const handleSignOut = () => {
    document.cookie = "consumer_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push(`/${params.slug}`);
  };

  const handlePauseSubscription = async (subscriptionId: string) => {
    if (!confirm("Pause this subscription? You won't be charged until you resume it.")) {
      return;
    }

    setActionLoading(subscriptionId);
    try {
      const res = await fetch(`/api/portal/${params.slug}/subscriptions/${subscriptionId}/pause`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to pause subscription");
      }

      alert("✅ Subscription paused successfully!");
      router.refresh();
      // Refresh subscriptions list
      const subsRes = await fetch(`/api/portal/${params.slug}/subscriptions`);
      const subsData = await subsRes.json();
      setSubscriptions(subsData.subscriptions || []);
    } catch (error) {
      alert("Failed to pause subscription. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeSubscription = async (subscriptionId: string) => {
    if (!confirm("Resume this subscription? You'll be charged on your next billing date.")) {
      return;
    }

    setActionLoading(subscriptionId);
    try {
      const res = await fetch(`/api/portal/${params.slug}/subscriptions/${subscriptionId}/resume`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to resume subscription");
      }

      alert("✅ Subscription resumed successfully!");
      router.refresh();
      // Refresh subscriptions list
      const subsRes = await fetch(`/api/portal/${params.slug}/subscriptions`);
      const subsData = await subsRes.json();
      setSubscriptions(subsData.subscriptions || []);
    } catch (error) {
      alert("Failed to resume subscription. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    setActionLoading(subscriptionId);
    try {
      const res = await fetch(`/api/portal/${params.slug}/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Failed to cancel subscription");
      }

      alert("✅ Subscription will be canceled at the end of your billing period.");
      setShowCancelDialog(null);
      router.refresh();
      // Refresh subscriptions list
      const subsRes = await fetch(`/api/portal/${params.slug}/subscriptions`);
      const subsData = await subsRes.json();
      setSubscriptions(subsData.subscriptions || []);
    } catch (error) {
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // Redirecting
  }

  const getStatusBadge = (status: string, stripeDetails: StripeDetails | null) => {
    if (stripeDetails?.trialEnd && new Date(stripeDetails.trialEnd) > new Date()) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Trial
        </span>
      );
    }

    switch (status.toLowerCase()) {
      case "active":
        return stripeDetails?.cancelAtPeriodEnd ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Canceling
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        );
      case "paused":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Paused
          </span>
        );
      case "canceled":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Canceled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Member Portal</h1>
            <p className="text-muted-foreground">
              Welcome back, {memberData?.name || memberData?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" asChild>
              <Link href={`/${params.slug}`}>Browse Plans</Link>
            </Button>
            <Button variant="secondary" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Active Subscriptions */}
        {subscriptions.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Your Subscriptions</h2>
            {subscriptions.map((subscription) => (
              <Card key={subscription.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {subscription.plan.membership.name} - {subscription.plan.name}
                      </CardTitle>
                      <CardDescription>
                        {subscription.plan.basePrice && formatCurrency(subscription.plan.basePrice, subscription.plan.currency)} per{" "}
                        {subscription.plan.membership.billingInterval.toLowerCase()}ly
                      </CardDescription>
                    </div>
                    {getStatusBadge(subscription.status, subscription.stripeDetails)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {subscription.stripeDetails && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Current Period</span>
                        <p className="font-medium">
                          {new Date(subscription.stripeDetails.currentPeriodStart).toLocaleDateString()} -{" "}
                          {new Date(subscription.stripeDetails.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      {subscription.stripeDetails.trialEnd && new Date(subscription.stripeDetails.trialEnd) > new Date() && (
                        <div>
                          <span className="text-muted-foreground">Trial Ends</span>
                          <p className="font-medium">{new Date(subscription.stripeDetails.trialEnd).toLocaleDateString()}</p>
                        </div>
                      )}
                      {subscription.stripeDetails.cancelAtPeriodEnd && (
                        <div>
                          <span className="text-muted-foreground">Cancels On</span>
                          <p className="font-medium">{new Date(subscription.stripeDetails.currentPeriodEnd).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 pt-4 border-t flex-wrap">
                    {/* Pause/Resume Button */}
                    {subscription.stripeDetails && !subscription.stripeDetails.cancelAtPeriodEnd && (
                      subscription.status === "active" ? (
                        <Button 
                          variant="secondary" 
                          size="small"
                          onClick={() => handlePauseSubscription(subscription.id)}
                          disabled={actionLoading === subscription.id}
                          prefix={<Pause className="h-3 w-3" />}
                        >
                          {actionLoading === subscription.id ? "Pausing..." : "Pause"}
                        </Button>
                      ) : subscription.status === "paused" ? (
                        <Button 
                          variant="secondary" 
                          size="small"
                          onClick={() => handleResumeSubscription(subscription.id)}
                          disabled={actionLoading === subscription.id}
                          prefix={<Play className="h-3 w-3" />}
                        >
                          {actionLoading === subscription.id ? "Resuming..." : "Resume"}
                        </Button>
                      ) : null
                    )}

                    {/* Cancel Button */}
                    {subscription.stripeDetails && !subscription.stripeDetails.cancelAtPeriodEnd && (
                      <Button 
                        variant="error" 
                        size="small"
                        onClick={() => setShowCancelDialog(subscription.id)}
                        disabled={actionLoading === subscription.id}
                        prefix={<Cross size={12} className="h-3 w-3" />}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Active Subscriptions</CardTitle>
              <CardDescription>
                You don't have any subscriptions yet. Browse our plans to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/${params.slug}`}>Browse Plans</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">Email:</span>
                <p className="font-medium">{memberData?.email}</p>
              </div>
              {memberData?.name && (
                <div>
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <p className="font-medium">{memberData.name}</p>
                </div>
              )}
              {defaultPaymentMethod && (
                <div>
                  <span className="text-sm text-muted-foreground">Payment Method:</span>
                  <p className="font-medium capitalize">
                    {defaultPaymentMethod.brand} ••••{defaultPaymentMethod.last4}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>Payment Methods</CardTitle>
              </div>
              {!showAddPaymentMethod && paymentMethods.length > 0 && (
                <Button 
                  variant="secondary" 
                  size="small"
                  onClick={handleShowAddPaymentMethod}
                  prefix={<Plus className="h-4 w-4" />}
                >
                  Add New
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethods.length > 0 ? (
              <PaymentMethodList
                paymentMethods={paymentMethods}
                defaultPaymentMethodId={defaultPaymentMethodId}
                onSetDefault={handleSetDefault}
                onRemove={handleRemove}
              />
            ) : (
              <div className="text-center py-6">
                <p className="text-muted-foreground mb-4">No payment methods saved yet</p>
                <Button 
                  variant="secondary" 
                  size="small"
                  onClick={handleShowAddPaymentMethod}
                  prefix={<Plus className="h-4 w-4" />}
                >
                  Add Payment Method
                </Button>
              </div>
            )}

            {/* Add New Payment Method Form */}
            {showAddPaymentMethod && clientSecret && stripePromise && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Add New Payment Method</h3>
                  <Button 
                    variant="tertiary" 
                    size="small"
                    onClick={() => setShowAddPaymentMethod(false)}
                  >
                    Cancel
                  </Button>
                </div>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: "stripe",
                      variables: {
                        colorPrimary: "#3867d6",
                      },
                    },
                  }}
                >
                  <PaymentMethodForm
                    slug={params.slug as string}
                    email={memberData?.email || ''}
                    onSuccess={handlePaymentMethodAdded}
                  />
                </Elements>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Cancel Subscription</h2>
              <button
                onClick={() => setShowCancelDialog(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Cross size={20} className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your subscription will be canceled at the end of your current billing period.
                You'll retain access until then.
              </p>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowCancelDialog(null)}
                  disabled={actionLoading === showCancelDialog}
                >
                  Keep Subscription
                </Button>
                <Button
                  variant="error"
                  onClick={() => handleCancelSubscription(showCancelDialog)}
                  disabled={actionLoading === showCancelDialog}
                >
                  {actionLoading === showCancelDialog ? "Canceling..." : "Cancel Subscription"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

