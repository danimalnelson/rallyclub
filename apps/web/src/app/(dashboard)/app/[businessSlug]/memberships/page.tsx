import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import { MembershipStatusBadge } from "@/components/memberships/MembershipStatusBadge";

export default async function MembershipsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    return notFound();
  }

  // Fetch memberships with plan counts
  const memberships = await prisma.membership.findMany({
    where: { businessId: business.id },
    include: {
      plans: {
        select: {
          id: true,
          status: true,
        },
      },
      _count: {
        select: {
          plans: true,
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">Memberships</h1>
          <p className="text-muted-foreground text-sm">
            Manage your subscription memberships and plans
          </p>
        </div>
        <Link href={`/app/${business.slug}/memberships/create`}>
          <Button size="sm">+ Create Membership</Button>
        </Link>
      </div>

        {/* Memberships Grid */}
        {memberships.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-xl font-semibold mb-2">No memberships yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first membership to start offering subscription plans.
              </p>
              <Link href={`/app/${business.slug}/memberships/create`}>
                <Button>+ Create Your First Membership</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {memberships.map((membership) => {
              const activePlans = membership.plans.filter(
                (p) => p.status === "ACTIVE"
              ).length;

              return (
                <Link
                  key={membership.id}
                  href={`/app/${business.slug}/memberships/${membership.id}/edit`}
                >
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-xl">
                          {membership.name}
                        </CardTitle>
                        <MembershipStatusBadge status={membership.status} />
                      </div>
                      {membership.description && (
                        <CardDescription className="line-clamp-2">
                          {membership.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Billing Type */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Billing:
                          </span>
                          <span className="font-medium">
                            {membership.billingAnchor === "IMMEDIATE"
                              ? "Rolling (Immediate)"
                              : `Cohort (Day ${membership.cohortBillingDay})`}
                          </span>
                        </div>

                        {/* Plans Count */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Plans:</span>
                          <span className="font-medium">
                            {activePlans} active / {membership._count.plans}{" "}
                            total
                          </span>
                        </div>

                        {/* Capacity */}
                        {membership.maxMembers && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Capacity:
                            </span>
                            <span className="font-medium">
                              {membership.maxMembers} members
                            </span>
                          </div>
                        )}

                        {/* Features */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {membership.allowMultiplePlans && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Multiple Plans
                            </span>
                          )}
                          {membership.giftEnabled && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Gifts
                            </span>
                          )}
                          {membership.pauseEnabled && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Pause
                            </span>
                          )}
                          {membership.skipEnabled && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              Skip
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick Stats */}
        {memberships.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {memberships.length}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Memberships
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {memberships.filter((m) => m.status === "ACTIVE").length}
                </div>
                <div className="text-sm text-muted-foreground">Active</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {memberships.reduce((acc, m) => acc + m._count.plans, 0)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Total Plans
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {memberships.reduce(
                    (acc, m) =>
                      acc +
                      m.plans.filter((p) => p.status === "ACTIVE").length,
                    0
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  Active Plans
                </div>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}

