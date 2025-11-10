"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

interface Business {
  id: string;
  name: string;
  slug: string;
  stripeAccountId: string | null;
  logoUrl: string | null;
}

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const res = await fetch(`/api/business/${params.businessId}`);
        if (res.ok) {
          const data = await res.json();
          setBusiness(data);
        }
      } catch (err) {
        console.error("Failed to fetch business:", err);
      }
    }
    fetchBusiness();
  }, [params.businessId]);

  const handleConnectStripe = async () => {
    setLoading(true);
    setError("");

    try {
      const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      
      const res = await fetch("/api/stripe/connect/account-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: params.businessId,
          refreshUrl: `${publicAppUrl}/app/${params.businessId}/settings`,
          returnUrl: `${publicAppUrl}/app/${params.businessId}/settings?connected=true`,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create account link");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{business.name} - Settings</h1>
            <button
              onClick={() => router.push(`/app/${business.id}`)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Stripe Connect */}
          <Card>
            <CardHeader>
              <CardTitle>Stripe Connect</CardTitle>
              <CardDescription>
                Connect your Stripe account to accept payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {business.stripeAccountId ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 bg-green-500 rounded-full"></div>
                    <span className="font-medium text-green-700">Connected</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Account ID: {business.stripeAccountId}
                  </p>
                  <Button variant="outline" onClick={handleConnectStripe} disabled={loading}>
                    Update Stripe Account
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-md mb-4">
                    <p className="text-sm">
                      You need to connect your Stripe account to start accepting payments for memberships.
                    </p>
                  </div>
                  <Button onClick={handleConnectStripe} disabled={loading}>
                    {loading ? "Connecting..." : "Connect with Stripe"}
                  </Button>
                </div>
              )}
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
          </Card>

          {/* Business Info */}
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>
                Your business details and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Business Name</label>
                <input
                  type="text"
                  value={business.name}
                  disabled
                  className="w-full px-3 py-2 border rounded-md bg-muted"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Slug</label>
                <input
                  type="text"
                  value={business.slug}
                  disabled
                  className="w-full px-3 py-2 border rounded-md bg-muted"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Contact support to update business details
              </p>
            </CardContent>
          </Card>

          {/* Embed Widget */}
          {business.stripeAccountId && (
            <Card>
              <CardHeader>
                <CardTitle>Embed Widget</CardTitle>
                <CardDescription>
                  Add this code to your website to show a join button
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 bg-muted rounded-md text-sm overflow-x-auto">
{`<script src="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/embed/widget.js" data-business="${business.slug}"></script>
<div id="wine-club-widget"></div>`}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}

