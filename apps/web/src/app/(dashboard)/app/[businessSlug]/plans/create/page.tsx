import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@wine-club/ui";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { PlanForm } from "@/components/plans/PlanForm";

export default async function CreatePlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ membershipId?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;
  const { membershipId } = await searchParams;

  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Get memberships for this business
  const memberships = await prisma.membership.findMany({
    where: {
      businessId: business.id,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Check if Stripe is connected
  if (!business.stripeAccountId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-6 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
            Connect Stripe First
          </h3>
          <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
            You need to connect your Stripe account before creating plans.
            Plans create products and prices in your Stripe account.
          </p>
          <Link href={`/app/${business.slug}/settings`}>
            <Button variant="warning">
              Go to Settings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if there are memberships
  if (memberships.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Create a Membership First
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
            Plans are organized within memberships. Create at least one
            membership before adding plans.
          </p>
          <Link href={`/app/${business.slug}/memberships/create`}>
            <Button>
              Create Membership
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PlanForm
        businessId={business.id}
        memberships={memberships}
        initialData={membershipId ? { membershipId } : undefined}
      />
    </div>
  );
}

