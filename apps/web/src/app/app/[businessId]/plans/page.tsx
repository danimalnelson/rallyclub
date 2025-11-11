import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";

export default async function PlansPage({
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

  const plans = await prisma.membershipPlan.findMany({
    where: {
      businessId: business.id,
    },
    include: {
      prices: {
        orderBy: { unitAmount: "asc" },
      },
      _count: {
        select: {
          subscriptions: true,
        },
      },
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
            <h1 className="text-2xl font-bold">{business.name} - Plans</h1>
            <Link href="/app">
              <button className="text-sm text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold mb-2">Membership Plans</h2>
            <p className="text-muted-foreground">
              Create and manage your wine club membership plans
            </p>
          </div>
          {business.stripeAccountId && (
            <Link href={`/app/${business.id}/plans/create`}>
              <Button>Create Plan</Button>
            </Link>
          )}
        </div>

        {!business.stripeAccountId && (
          <Card className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle>Connect Stripe First</CardTitle>
              <CardDescription>
                You need to connect your Stripe account before creating plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/app/${business.id}/settings`}>
                <Button>Go to Settings</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {plans.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Plans Yet</CardTitle>
              <CardDescription>
                Create your first membership plan to start accepting members
              </CardDescription>
            </CardHeader>
            {business.stripeAccountId && (
              <CardContent>
                <Link href={`/app/${business.id}/plans/create`}>
                  <Button>Create Your First Plan</Button>
                </Link>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan: any) => {
              const benefits = Array.isArray(plan.benefits)
                ? plan.benefits
                : (plan.benefits as any)?.items || [];

              return (
                <Card key={plan.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{plan.name}</CardTitle>
                        <CardDescription className="mt-1">{plan.description}</CardDescription>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          plan.status === "ACTIVE"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {plan.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Pricing:</div>
                      {plan.prices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No prices set</p>
                      ) : (
                        <div className="space-y-1">
                          {plan.prices.map((price: any) => (
                            <div key={price.id} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                {price.interval}ly{price.isDefault && " (default)"}
                              </span>
                              <span className="font-medium">
                                {formatCurrency(price.unitAmount, price.currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {benefits.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Benefits:</div>
                        <ul className="space-y-1">
                          {benefits.slice(0, 3).map((benefit: string, idx: number) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-1">
                              <span className="text-primary">•</span>
                              <span className="line-clamp-1">{benefit}</span>
                            </li>
                          ))}
                          {benefits.length > 3 && (
                            <li className="text-xs text-muted-foreground">
                              +{benefits.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="pt-2 border-t text-sm text-muted-foreground">
                      {plan._count.subscriptions} active subscriptions
                    </div>

                    <Link href={`/app/${business.id}/plans/${plan.id}`}>
                      <Button variant="outline" className="w-full">
                        Manage Plan
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

