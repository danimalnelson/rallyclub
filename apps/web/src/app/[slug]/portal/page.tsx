"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import Link from "next/link";

interface StripeDetails {
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  trialEnd: string | null;
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
    interval: string;
    intervalCount: number;
    membership: {
      name: string;
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
  const [openingPortal, setOpeningPortal] = useState(false);

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
        setLoading(false);
      })
      .catch(() => {
        // Redirect to sign-in
        router.push(`/${params.slug}/auth/signin?returnUrl=${encodeURIComponent(`/${params.slug}/portal`)}`);
      });
  }, [params.slug, router]);

  const handleOpenStripePortal = async () => {
    setOpeningPortal(true);
    try {
      const res = await fetch(`/api/portal/${params.slug}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumerEmail: memberData.email }),
      });

      if (!res.ok) {
        throw new Error("Failed to open portal");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      alert("Failed to open Stripe portal. Please try again.");
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleSignOut = () => {
    document.cookie = "consumer_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push(`/${params.slug}`);
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
            <Button variant="outline" asChild>
              <Link href={`/${params.slug}`}>Browse Plans</Link>
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
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
                        {subscription.plan.intervalCount > 1 && `${subscription.plan.intervalCount} `}
                        {subscription.plan.interval.toLowerCase()}
                        {subscription.plan.intervalCount > 1 && "s"}
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
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleOpenStripePortal}
                      disabled={openingPortal}
                    >
                      {openingPortal ? "Loading..." : "Manage Subscription"}
                    </Button>
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

        {/* Stripe Portal Access */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Portal</CardTitle>
            <CardDescription>
              Manage payment methods, view invoices, and update billing information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleOpenStripePortal} disabled={openingPortal} variant="outline" className="w-full">
              {openingPortal ? "Opening..." : "Open Stripe Customer Portal"}
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              You'll be redirected to a secure Stripe portal
            </p>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

