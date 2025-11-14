import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { PlanForm } from "@/components/plans/PlanForm";

export default async function CreatePlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ membershipId?: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessId } = await params;
  const { membershipId } = await searchParams;

  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
  });

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
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Create Plan</h1>
              <Link href={`/app/${business.id}/plans`}>
                <button className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back to Plans
                </button>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="p-6 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
              Connect Stripe First
            </h3>
            <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
              You need to connect your Stripe account before creating plans.
              Plans create products and prices in your Stripe account.
            </p>
            <Link href={`/app/${business.id}/settings`}>
              <button className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                Go to Settings
              </button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Check if there are memberships
  if (memberships.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Create Plan</h1>
              <Link href={`/app/${business.id}/plans`}>
                <button className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back to Plans
                </button>
              </Link>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="p-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Create a Membership First
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
              Plans are organized within memberships. Create at least one
              membership before adding plans.
            </p>
            <Link href={`/app/${business.id}/memberships/create`}>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Create Membership
              </button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{business.name} - Create Plan</h1>
            <Link href={`/app/${business.id}/plans`}>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Plans
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PlanForm
          businessId={business.id}
          memberships={memberships}
          initialData={membershipId ? { membershipId } : undefined}
        />
      </main>
    </div>
  );
}
