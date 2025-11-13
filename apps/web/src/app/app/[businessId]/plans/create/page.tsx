import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

export default async function CreatePlanPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessId } = await params;
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

  // Get memberships for this business (NEW models)
  const memberships = await prisma.membership.findMany({
    where: {
      businessId: business.id,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Create New Plan</CardTitle>
            <CardDescription>
              The new Plan creation UI is coming soon! For now, plans can be created via the API or seed data.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {memberships.length === 0 ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  Create a Membership First
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                  Plans belong to memberships. You need to create at least one membership before creating plans.
                </p>
                <p className="text-sm text-muted-foreground">
                  For now, use the seed script to create example memberships and plans:
                </p>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                  cd packages/db && npx tsx seed-subscriptions.ts
                </pre>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold mb-2">Available Memberships</h3>
                  <div className="space-y-2">
                    {memberships.map((membership) => (
                      <div
                        key={membership.id}
                        className="p-3 border rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{membership.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {membership.billingAnchor === "NEXT_INTERVAL"
                                ? `Cohort billing (day ${membership.cohortBillingDay})`
                                : "Rolling billing"}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              membership.status === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {membership.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    UI Coming Soon
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                    The Plan creation UI is part of Phase 3 (Business Dashboard). For now, you can:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
                    <li>Use the seed script to create example plans</li>
                    <li>Use the API directly: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">POST /api/plans/create</code></li>
                    <li>Use Prisma Studio to create plans manually</li>
                  </ol>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold">Quick Start with Seed Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Run the seed script to create example memberships and plans:
                  </p>
                  <pre className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                    cd packages/db{"\n"}
                    npx tsx seed-subscriptions.ts
                  </pre>
                  <p className="text-sm text-muted-foreground mt-2">
                    This will create:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>2 memberships (Wine Club, Beer Club)</li>
                    <li>5 plans (monthly, quarterly, annual, dynamic, trial)</li>
                    <li>Sample subscriptions and price queue items</li>
                  </ul>
                </div>
              </>
            )}

            <div className="pt-4 border-t">
              <Link
                href={`/app/${business.id}/plans`}
                className="text-sm text-primary hover:underline"
              >
                ← Back to Plans List
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

