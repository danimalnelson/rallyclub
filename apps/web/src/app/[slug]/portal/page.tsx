"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

export default function MemberPortalPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [memberData, setMemberData] = useState<any>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    // Check if consumer is authenticated
    fetch(`/api/consumer/auth/session`)
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        throw new Error("Not authenticated");
      })
      .then((data) => {
        setAuthenticated(true);
        setMemberData(data);
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
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manage Your Membership</CardTitle>
            <CardDescription>
              Update payment methods, view invoices, or cancel your subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleOpenStripePortal} disabled={openingPortal} className="w-full">
              {openingPortal ? "Opening..." : "Open Stripe Customer Portal"}
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              You'll be redirected to a secure Stripe portal to manage your subscription
            </p>
          </CardContent>
        </Card>

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

