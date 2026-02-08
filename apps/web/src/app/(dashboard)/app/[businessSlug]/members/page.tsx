import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Card, CardContent, formatDate, formatCurrency, Button } from "@wine-club/ui";
import { Download } from "lucide-react";

export default async function MembersPage({
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

  // Group subscriptions by consumer email (to consolidate duplicate consumer records)
  const consumersMap = new Map<string, {
    consumer: any;
    subscriptions: any[];
  }>();

  planSubscriptions.forEach((sub) => {
    const email = sub.consumer.email.toLowerCase();
    
    if (!consumersMap.has(email)) {
      consumersMap.set(email, {
        consumer: sub.consumer,
        subscriptions: [],
      });
    } else {
      // If we already have this email, prefer the consumer with a name set
      const existing = consumersMap.get(email)!;
      if (!existing.consumer.name && sub.consumer.name) {
        existing.consumer = sub.consumer;
      }
    }
    
    consumersMap.get(email)!.subscriptions.push(sub);
  });

  const members = Array.from(consumersMap.values());

  return (
    <div className="max-w-7xl mx-auto">
      {/* Actions */}
      {members.length > 0 && (
        <div className="mb-6 flex justify-end">
          <a
            href={`/api/business/${business.id}/members/export`}
            download
            className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>
      )}

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
                (sub: any) => sub.status === "active" || sub.status === "trialing" || sub.status === "ACTIVE"
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
                              {member.consumer.name || member.consumer.email.split('@')[0]}
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

                        {/* All Subscriptions (active, paused, incomplete) */}
                        {member.subscriptions.filter((sub: any) => 
                          sub.status === "active" || 
                          sub.status === "ACTIVE" || 
                          sub.status === "trialing" || 
                          sub.status === "paused" || 
                          sub.status === "incomplete"
                        ).length > 0 && (
                          <div className="mt-4 space-y-2">
                            {member.subscriptions
                              .filter((sub: any) => 
                                sub.status === "active" || 
                                sub.status === "ACTIVE" || 
                                sub.status === "trialing" || 
                                sub.status === "paused" || 
                                sub.status === "incomplete"
                              )
                              .map((sub: any) => (
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
                                  <div className="font-medium capitalize">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                      sub.status === "active" || sub.status === "ACTIVE" || sub.status === "trialing"
                                        ? "bg-green-100 text-green-700"
                                        : sub.status === "paused"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : sub.status === "incomplete"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-gray-100 text-gray-700"
                                    }`}>
                                      {sub.status}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <div className="text-muted-foreground">Next Billing</div>
                                  <div className="font-medium">
                                    {sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "N/A"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subscription Count */}
                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            {activeSubscriptions.length} active subscription{activeSubscriptions.length !== 1 ? 's' : ''}
                            {member.subscriptions.length > activeSubscriptions.length && 
                              ` • ${member.subscriptions.length - activeSubscriptions.length} inactive`
                            }
                          </span>
                          <span>•</span>
                          <span>
                            Member since {formatDate(member.consumer.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <Link href={`/app/${business.slug}/members/${member.consumer.id}`}>
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
    </div>
  );
}
