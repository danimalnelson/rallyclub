"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const businessId = searchParams.get("businessId");
  
  const [businessName, setBusinessName] = useState("");
  const [businessSlug, setBusinessSlug] = useState("");
  const [status, setStatus] = useState<"CREATED" | "ONBOARDING_PENDING" | "ONBOARDING_COMPLETE" | "SUSPENDED" | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!businessId) {
      router.push("/app");
      return;
    }

    // Fetch business details
    let interval: ReturnType<typeof setInterval>;

    const fetchBusiness = () => {
      fetch(`/api/business/${businessId}`)
        .then(res => res.json())
        .then(data => {
          if (data.name) {
            setBusinessName(data.name);
            setBusinessSlug(data.slug);
          }
          if (data.status) {
            setStatus(data.status);
            if (data.status === "ONBOARDING_COMPLETE") {
              setIsVerifying(false);
              if (interval) {
                clearInterval(interval);
              }
            } else {
              setIsVerifying(true);
            }
          }
        })
        .catch(err => {
          console.error("Error fetching business:", err);
        });
    };

    fetchBusiness();
    interval = setInterval(fetchBusiness, 5000);

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [businessId, router]);

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
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                ✓
              </div>
              <span className="text-sm">Connect Stripe</span>
            </div>
            <div className="w-12 h-0.5 bg-primary"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                ✓
              </div>
              <span className="text-sm font-medium">Complete</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl">🎉 You&apos;re All Set!</CardTitle>
            <CardDescription>
              {businessName} is ready to start selling wine club memberships
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 border rounded-lg p-6 space-y-4">
              <h4 className="font-semibold">What&apos;s Next?</h4>
              
              {isVerifying && (
                <div className="flex items-start gap-3 rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-sm text-amber-700">
                  <span className="mt-1">⏳</span>
                  <p>
                    We&apos;re waiting for Stripe to confirm your account. This usually takes a few seconds.
                    Once complete, we&apos;ll unlock your dashboard automatically.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Create Membership Plans</p>
                    <p className="text-sm text-muted-foreground">
                      Set up your wine club tiers and pricing
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Share Your Page</p>
                    <p className="text-sm text-muted-foreground">
                      Your public page: {businessSlug && (
                        <a 
                          href={`/${businessSlug}`} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          vintigo.com/{businessSlug}
                        </a>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Start Accepting Members</p>
                    <p className="text-sm text-muted-foreground">
                      Customers can join and you&apos;ll see them in your dashboard
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button 
                onClick={() => router.push(`/app/${businessId}`)}
                size="lg"
                className="min-w-64"
                disabled={status !== "ONBOARDING_COMPLETE"}
              >
                {status === "ONBOARDING_COMPLETE" ? "Go to Dashboard →" : "Finishing Stripe Setup..."}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}

