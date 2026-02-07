import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import { PlanStatusBadge } from "@/components/plans/PlanStatusBadge";

export default async function PlansPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Fetch memberships with their plans
  const memberships = await prisma.membership.findMany({
    where: { businessId: business.id },
    include: {
      plans: {
        include: {
          _count: {
            select: {
              planSubscriptions: true,
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  const totalPlans = memberships.reduce((acc, m) => acc + m.plans.length, 0);
  const activePlans = memberships.reduce(
    (acc, m) => acc + m.plans.filter((p) => p.status === "ACTIVE").length,
    0
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Subscription Plans</h1>
          <p className="text-muted-foreground text-sm">
            Manage your membership plans and pricing
          </p>
        </div>
        <Link href={`/app/${business.slug}/memberships`}>
          <Button variant="outline" size="sm">Manage Memberships</Button>
        </Link>
      </div>

        {/* Stripe Check */}
        {!business.stripeAccountId && (
          <Card className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle>Connect Stripe First</CardTitle>
              <CardDescription>
                You need to connect your Stripe account before creating plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/app/${business.slug}/settings`}>
                <Button>Go to Settings</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* No Memberships Warning */}
        {memberships.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Create a Membership First</CardTitle>
              <CardDescription>
                Plans are organized within memberships. Create a membership before adding plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/app/${business.slug}/memberships/create`}>
                <Button>Create Your First Membership</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Plans Grouped by Membership */}
        {memberships.length > 0 && (
          <div className="space-y-8">
            {memberships.map((membership) => (
              <div key={membership.id}>
                {/* Membership Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">{membership.name}</h2>
                    {membership.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {membership.description}
                      </p>
                    )}
                  </div>
                  <Link href={`/app/${business.slug}/plans/create?membershipId=${membership.id}`}>
                    <Button size="sm">+ Add Plan</Button>
                  </Link>
                </div>

                {/* Plans Grid */}
                {membership.plans.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground mb-4">
                        No plans in this membership yet
                      </p>
                      <Link href={`/app/${business.slug}/plans/create?membershipId=${membership.id}`}>
                        <Button size="sm">Create First Plan</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {membership.plans.map((plan) => (
                      <Link
                        key={plan.id}
                        href={`/app/${business.slug}/plans/${plan.id}/edit`}
                      >
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                          <CardHeader>
                            <div className="flex items-start justify-between mb-2">
                              <CardTitle className="text-xl">{plan.name}</CardTitle>
                              <PlanStatusBadge status={plan.status} />
                            </div>
                            {plan.description && (
                              <CardDescription className="line-clamp-2">
                                {plan.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Pricing */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Price:
                              </span>
                              <span className="text-lg font-bold">
                                {plan.pricingType === "FIXED" && plan.basePrice
                                  ? formatCurrency(plan.basePrice, plan.currency)
                                  : "Dynamic"}
                              </span>
                            </div>

                            {/* Interval */}
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Frequency:
                              </span>
                              <span className="font-medium">
                                Billed {membership.billingInterval.toLowerCase()}ly
                              </span>
                            </div>

                            {/* Subscriptions */}
                            <div className="pt-3 border-t flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Subscriptions:
                              </span>
                              <span className="font-medium">
                                {plan._count.planSubscriptions}
                              </span>
                            </div>

                            {/* Features */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              {plan.setupFee && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  Setup fee
                                </span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Quick Stats */}
        {totalPlans > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{totalPlans}</div>
                <div className="text-sm text-muted-foreground">Total Plans</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{activePlans}</div>
                <div className="text-sm text-muted-foreground">Active Plans</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {memberships.reduce(
                    (acc, m) =>
                      acc +
                      m.plans.reduce(
                        (sum, p) => sum + p._count.planSubscriptions,
                        0
                      ),
                    0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Subscriptions
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}

