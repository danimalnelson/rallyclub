import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Card, CardContent, formatDate } from "@wine-club/ui";

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

  const members = await prisma.member.findMany({
    where: {
      businessId: business.id,
    },
    include: {
      consumer: true,
      subscriptions: {
        include: {
          membershipPlan: true,
          price: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
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
                Members will appear here when they join your club
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {members.map((member) => {
              const subscription = member.subscriptions[0];
              
              return (
                <Card key={member.id}>
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
                              member.status === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : member.status === "PAST_DUE"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {member.status}
                          </span>
                        </div>

                        {subscription && (
                          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Plan</div>
                              <div className="font-medium">{subscription.membershipPlan.name}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Billing</div>
                              <div className="font-medium capitalize">{subscription.price.interval}ly</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Next Billing</div>
                              <div className="font-medium">
                                {formatDate(subscription.currentPeriodEnd)}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-2 text-xs text-muted-foreground">
                          Member since {formatDate(member.createdAt)}
                        </div>
                      </div>

                      <div>
                        <Link href={`/app/${business.id}/members/${member.id}`}>
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

