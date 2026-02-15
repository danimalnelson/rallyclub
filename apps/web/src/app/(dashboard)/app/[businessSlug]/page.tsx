import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getBusinessBySlug } from "@/lib/data/business";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wine-club/ui";
import { CopyButton } from "@/components/copy-button";
import { DashboardContent } from "./_components/DashboardContent";
import { DashboardRevenue } from "./_components/DashboardRevenue";
import {
  DashboardSkeleton,
  RevenueSkeleton,
} from "./_components/DashboardSkeleton";

export default async function BusinessDashboardPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;

  // Uses React cache() — shared with layout, so only one DB call per request
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Handle non-complete onboarding states
  if (business.status !== "ONBOARDING_COMPLETE") {
    switch (business.status) {
      case "CREATED":
      case "DETAILS_COLLECTED":
        redirect(`/onboarding/details`);
      case "STRIPE_ACCOUNT_CREATED":
      case "STRIPE_ONBOARDING_REQUIRED":
        redirect(`/onboarding/connect?businessId=${business.id}`);
      case "STRIPE_ONBOARDING_IN_PROGRESS":
      case "ONBOARDING_PENDING":
        redirect(`/onboarding/return`);
      case "PENDING_VERIFICATION":
      case "RESTRICTED":
        // Allow limited dashboard access for these states
        break;
      case "FAILED":
      case "ABANDONED":
        redirect(`/onboarding/connect?businessId=${business.id}`);
      case "SUSPENDED":
        break;
      default:
        redirect(`/onboarding`);
    }
  }

  const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="max-w-7xl mx-auto">
      {/* Status Banners — render immediately (no data fetching needed) */}
      {business.status === "PENDING_VERIFICATION" && (
        <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">⏳</span>
              Account Verification in Progress
            </CardTitle>
            <CardDescription>
              Your Stripe account is being verified. This usually takes a
              few minutes to 24 hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Link href="/onboarding/return">
                <Button>Check Status</Button>
              </Link>
              <a
                href={`https://dashboard.stripe.com/${business.stripeAccountId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
              >
                Open Stripe Dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {business.status === "RESTRICTED" && (
        <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">⚠️</span>
              Action Required: Complete Verification
            </CardTitle>
            <CardDescription>
              Your Stripe account requires additional information to
              process payments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/onboarding/return">
              <button className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                Complete Requirements
              </button>
            </Link>
          </CardContent>
        </Card>
      )}

      {business.status === "SUSPENDED" && (
        <Card className="mb-6 border-red-600 bg-red-100 dark:bg-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
              <span className="text-2xl">🚫</span>
              Account Suspended
            </CardTitle>
            <CardDescription className="text-red-800 dark:text-red-200">
              Your account has been suspended. Please contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Main dashboard content — streams in as DB queries resolve */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          businessId={business.id}
          businessSlug={business.slug}
          businessCurrency={business.currency}
          stripeAccountId={business.stripeAccountId}
        />
      </Suspense>

      {/* Revenue charts — streams in as cached Stripe data resolves */}
      <Suspense fallback={<RevenueSkeleton />}>
        <DashboardRevenue
          businessId={business.id}
          businessCurrency={business.currency}
          stripeAccountId={business.stripeAccountId}
        />
      </Suspense>

      {/* Public Page Card — renders immediately */}
      <Card>
        <CardHeader>
          <CardTitle>Public Page</CardTitle>
          <CardDescription>
            Share this link with potential members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={`${publicAppUrl}/${business.slug}`}
              readOnly
              className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm font-mono"
            />
            <CopyButton
              text={`${publicAppUrl}/${business.slug}`}
              className="px-4 py-2 border rounded-md hover:bg-accent"
            />
          </div>
          <div className="flex gap-4">
            <a
              href={`${publicAppUrl}/${business.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Preview page →
            </a>
            <Link
              href={`/app/${business.slug}/settings`}
              className="text-sm text-muted-foreground hover:underline"
            >
              Customize
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
