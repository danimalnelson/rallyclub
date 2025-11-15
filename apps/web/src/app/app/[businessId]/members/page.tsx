import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Card, CardContent, formatDate, formatCurrency } from "@wine-club/ui";

export default async function MembersPage({
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

  // Get all consumers who have subscriptions to this business's plans
  const planSubscriptions = await prisma.planSubscription.findMany({
    where: {
      plan: {
        businessId: business.id,
      },
    },
    include: {
      consumer: true,
      plan: {
        include: {
          membership: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Group subscriptions by consumer
  const consumersMap = new Map<string, {
    consumer: any;
    subscriptions: any[];
  }>();

  planSubscriptions.forEach((sub) => {
    if (!consumersMap.has(sub.consumer.id)) {
      consumersMap.set(sub.consumer.id, {
        consumer: sub.consumer,
        subscriptions: [],
      });
    }
    consumersMap.get(sub.consumer.id)!.subscriptions.push(sub);
  });

  const members = Array.from(consumersMap.values());

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{business.name} - Members</h1>
            <Link href={`/app/${business.id}`}>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Members</h2>
          <p className="text-muted-foreground">
            View and manage your club members
          </p>
        </div>

        {members.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No members yet</p>
              <p className="text-sm text-muted-foreground">
                Members will appear here when they subscribe to your plans
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {members.map((member) => {
              const activeSubscriptions = member.subscriptions.filter(
                (sub: any) => sub.status === "active" || sub.status === "trialing"
              );
              const latestSubscription = member.subscriptions[0];
              
              return (
                <Card key={member.consumer.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="font-medium text-lg">
                              {member.consumer.name || "No name"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {member.consumer.email}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              activeSubscriptions.length > 0
                                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            }`}
                          >
                            {activeSubscriptions.length > 0 ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </div>

                        {/* Active Subscriptions */}
                        {activeSubscriptions.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {activeSubscriptions.map((sub: any) => (
                              <div key={sub.id} className="grid grid-cols-4 gap-4 text-sm p-3 bg-muted/50 rounded-lg">
                                <div>
                                  <div className="text-muted-foreground">Plan</div>
                                  <div className="font-medium">{sub.plan.name}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Membership</div>
                                  <div className="font-medium">{sub.plan.membership.name}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Status</div>
                                  <div className="font-medium capitalize">{sub.status}</div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Next Billing</div>
                                  <div className="font-medium">
                                    {formatDate(sub.currentPeriodEnd)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subscription Count */}
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Total subscriptions: {member.subscriptions.length}
                          </span>
                          <span>•</span>
                          <span>
                            Member since {formatDate(member.consumer.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <Link href={`/app/${business.id}/members/${member.consumer.id}`}>
                          <button className="px-4 py-2 text-sm border rounded-md hover:bg-accent">
                            View Details
                          </button>
                        </Link>
                      </div>
                    </div>
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
