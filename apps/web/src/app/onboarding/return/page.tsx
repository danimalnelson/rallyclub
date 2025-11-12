"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface OnboardingStatus {
  hasBusiness: boolean;
  businessId?: string;
  businessName?: string;
  status: string;
  nextAction: {
    action: string;
    message: string;
    canAccessDashboard: boolean;
  };
  stripeChargesEnabled?: boolean;
  stripeDetailsSubmitted?: boolean;
}

export default function OnboardingReturnPage() {
  const router = useRouter();
  const session = useSession();
  const sessionStatus = session?.status || "loading";
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    setChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/onboarding/status");
      
      if (!response.ok) {
        throw new Error("Failed to fetch onboarding status");
      }

      const data = await response.json();
      setOnboardingStatus(data);

      // If onboarding complete, redirect to dashboard
      if (data.status === "ONBOARDING_COMPLETE" && data.canAccessDashboard) {
        setTimeout(() => {
          router.push(`/app/${data.businessId}`);
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to check status");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      checkStatus().finally(() => setLoading(false));
    } else if (sessionStatus === "unauthenticated") {
      router.push("/auth/signin");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  const handleResumeOnboarding = async () => {
    if (!onboardingStatus?.businessId) return;

    try {
      const response = await fetch("/api/stripe/connect/account-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: onboardingStatus.businessId,
          refreshUrl: `${window.location.origin}/onboarding/return?refresh=true`,
          returnUrl: `${window.location.origin}/onboarding/return`,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate onboarding link");
      }

      const { url, alreadyComplete } = await response.json();

      if (alreadyComplete) {
        // Refresh status
        await checkStatus();
      } else if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err.message || "Failed to resume onboarding");
    }
  };

  if (loading || sessionStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !onboardingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => checkStatus()}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!onboardingStatus?.hasBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No business found. Redirecting...</p>
        </div>
      </div>
    );
  }

  const { status, nextAction } = onboardingStatus;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {onboardingStatus.businessName}
          </h1>
          <p className="text-gray-600">Account Setup Status</p>
        </div>

        {/* Status Card */}
        <div className="mb-8">
          {status === "ONBOARDING_COMPLETE" && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-green-600 text-5xl mb-4">✓</div>
              <h2 className="text-2xl font-semibold text-green-900 mb-2">
                Onboarding Complete!
              </h2>
              <p className="text-green-700 mb-4">
                Your Stripe account is fully set up and ready to accept payments.
              </p>
              <p className="text-sm text-green-600">Redirecting to dashboard...</p>
            </div>
          )}

          {status === "PENDING_VERIFICATION" && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="text-yellow-600 text-4xl mb-4 text-center">⏳</div>
              <h2 className="text-xl font-semibold text-yellow-900 mb-2 text-center">
                Verification in Progress
              </h2>
              <p className="text-yellow-700 mb-6 text-center">
                {nextAction.message}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => checkStatus()}
                  disabled={checking}
                  className="w-full bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-medium"
                >
                  {checking ? "Checking..." : "Check Status"}
                </button>
                <button
                  onClick={handleResumeOnboarding}
                  className="w-full bg-white text-yellow-700 border border-yellow-300 px-4 py-3 rounded-lg hover:bg-yellow-50 font-medium"
                >
                  Open Stripe Dashboard
                </button>
              </div>
            </div>
          )}

          {status === "RESTRICTED" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <div className="text-red-600 text-4xl mb-4 text-center">⚠</div>
              <h2 className="text-xl font-semibold text-red-900 mb-2 text-center">
                Additional Information Required
              </h2>
              <p className="text-red-700 mb-6 text-center">
                {nextAction.message}
              </p>
              <button
                onClick={handleResumeOnboarding}
                className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium"
              >
                Complete Requirements
              </button>
            </div>
          )}

          {(status === "STRIPE_ONBOARDING_IN_PROGRESS" || 
            status === "STRIPE_ONBOARDING_REQUIRED" ||
            status === "ONBOARDING_PENDING") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-blue-600 text-4xl mb-4 text-center">📋</div>
              <h2 className="text-xl font-semibold text-blue-900 mb-2 text-center">
                Complete Your Setup
              </h2>
              <p className="text-blue-700 mb-6 text-center">
                {nextAction.message}
              </p>
              <button
                onClick={handleResumeOnboarding}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Continue Onboarding
              </button>
            </div>
          )}

          {status === "FAILED" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <div className="text-red-600 text-4xl mb-4">✕</div>
              <h2 className="text-xl font-semibold text-red-900 mb-2">
                Onboarding Failed
              </h2>
              <p className="text-red-700 mb-6">{nextAction.message}</p>
              <button
                onClick={() => router.push("/support")}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 font-medium"
              >
                Contact Support
              </button>
            </div>
          )}
        </div>

        {/* Status Details */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2 font-medium text-gray-900">
                {status.replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Charges Enabled:</span>
              <span className="ml-2 font-medium text-gray-900">
                {onboardingStatus.stripeChargesEnabled ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Details Submitted:</span>
              <span className="ml-2 font-medium text-gray-900">
                {onboardingStatus.stripeDetailsSubmitted ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Dashboard Access:</span>
              <span className="ml-2 font-medium text-gray-900">
                {nextAction.canAccessDashboard ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

