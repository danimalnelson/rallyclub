"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

function ConnectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [status, setStatus] = useState<"CREATED" | "ONBOARDING_PENDING" | "ONBOARDING_COMPLETE" | "SUSPENDED" | null>(null);

  useEffect(() => {
    if (!businessId) {
      router.push("/onboarding/details");
      return;
    }

    // Fetch business details
    fetch(`/api/business/${businessId}`)
      .then(res => res.json())
      .then(data => {
        if (data.name) {
          setBusinessName(data.name);
        }
        if (data.status) {
          setStatus(data.status);
          if (data.status === "ONBOARDING_COMPLETE") {
            router.replace(`/onboarding/success?businessId=${businessId}`);
          }
        }
      })
      .catch(err => {
        console.error("Error fetching business:", err);
      });
  }, [businessId, router]);

  const handleConnectStripe = async () => {
    if (!businessId) return;
    
    setLoading(true);
    setError("");

    try {
      // Build full URLs for Stripe redirect
      const baseUrl = window.location.origin;
      
      const res = await fetch("/api/stripe/connect/account-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          refreshUrl: `${baseUrl}/onboarding/connect?businessId=${businessId}`,
          returnUrl: `${baseUrl}/onboarding/success?businessId=${businessId}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create Stripe Connect link");
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                ✓
              </div>
              <span className="text-sm">Business Details</span>
            </div>
            <div className="w-12 h-0.5 bg-primary"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                2
              </div>
              <span className="text-sm font-medium">Connect Stripe</span>
            </div>
            <div className="w-12 h-0.5 bg-muted-foreground/30"></div>
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center font-semibold">
                3
              </div>
              <span className="text-sm">Complete</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connect Payment Processing</CardTitle>
            <CardDescription>
              Connect Stripe to accept payments for {businessName || "your business"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 border rounded-lg p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  💳
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Accept Payments</h4>
                  <p className="text-sm text-muted-foreground">
                    Securely process credit cards and recurring subscriptions
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  🔒
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Secure & Compliant</h4>
                  <p className="text-sm text-muted-foreground">
                    Stripe handles all PCI compliance and security
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  💰
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Direct Payouts</h4>
                  <p className="text-sm text-muted-foreground">
                    Funds go directly to your bank account (minus platform fee)
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {status === "ONBOARDING_PENDING" && (
              <div className="p-3 bg-primary/10 text-primary rounded-md text-sm">
                We sent you to Stripe Connect earlier. You can continue onboarding or reconnect if needed.
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/onboarding/details")}
              >
                Back
              </Button>
              <Button onClick={handleConnectStripe} disabled={loading} className="min-w-48">
                {loading ? "Redirecting to Stripe..." : "Connect with Stripe"}
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              You&apos;ll be redirected to Stripe to complete your account setup
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <ConnectContent />
    </Suspense>
  );
}

