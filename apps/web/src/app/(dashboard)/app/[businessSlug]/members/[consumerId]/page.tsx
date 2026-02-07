import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Card, CardContent, CardHeader, CardTitle, formatDate, formatCurrency, Button } from "@wine-club/ui";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EditMemberInfoDialog } from "@/components/members/EditMemberInfoDialog";
import { SubscriptionActions } from "@/components/members/SubscriptionActions";
import { MemberNotes } from "@/components/members/MemberNotes";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ businessSlug: string; consumerId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug, consumerId } = await params;

  // Uses React cache() — shared with layout
  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Run consumer, subscriptions, and notes queries in parallel
  const [consumer, subscriptions, notes] = await Promise.all([
    prisma.consumer.findUnique({
      where: { id: consumerId },
    }),
    prisma.planSubscription.findMany({
      where: {
        consumerId,
        plan: { businessId: business.id },
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
    (async () => {
      try {
        if (prisma.memberNote) {
          return await prisma.memberNote.findMany({
            where: { consumerId },
            include: {
              createdBy: {
                select: { name: true, email: true },
              },
            },
            orderBy: { createdAt: "desc" },
          });
        }
        return [];
      } catch {
        return [];
      }
    })(),
  ]);

  if (!consumer) {
    notFound();
  }

  const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === "active" || sub.status === "trialing"
  );
  const inactiveSubscriptions = subscriptions.filter(
    (sub) => sub.status !== "active" && sub.status !== "trialing"
  );

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/app/${business.slug}/members`}>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {consumer.name || consumer.email.split('@')[0]}
          </h1>
          <p className="text-sm text-muted-foreground">{consumer.email}</p>
        </div>
      </div>
        {/* Member Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Member Information</CardTitle>
              <EditMemberInfoDialog
                businessId={business.id}
                consumerId={consumer.id}
                initialName={consumer.name}
                initialPhone={consumer.phone}
                email={consumer.email}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Email</div>
                <div className="font-medium">{consumer.email}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Phone</div>
                <div className="font-medium">{consumer.phone || "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Member Since</div>
                <div className="font-medium">{formatDate(consumer.createdAt)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Active Subscriptions</div>
                <div className="font-medium">{activeSubscriptions.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        {activeSubscriptions.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4">Active Subscriptions</h2>
            <div className="space-y-4">
              {activeSubscriptions.map((sub) => (
                <Card key={sub.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">{sub.plan.name}</h3>
                          {sub.pausedAt ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                              ⏸ Paused
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              {sub.status}
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Price</div>
                            <div className="font-medium">
                              {sub.plan.basePrice ? formatCurrency(sub.plan.basePrice, sub.plan.currency) : "Variable"}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Current Period</div>
                            <div className="font-medium">
                              {formatDate(sub.currentPeriodStart)} - {formatDate(sub.currentPeriodEnd)}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Next Billing</div>
                            <div className="font-medium">{formatDate(sub.currentPeriodEnd)}</div>
                          </div>
                        </div>

                        {sub.cancelAtPeriodEnd && (
                          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              ⚠️ Cancels at end of period
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <a
                          href={`https://dashboard.stripe.com/${business.stripeAccountId ? 'connect/accounts/' + business.stripeAccountId + '/' : ''}subscriptions/${sub.stripeSubscriptionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          View in Stripe <ExternalLink className="h-3 w-3" />
                        </a>
                        <span className="text-xs text-muted-foreground">
                          Created {formatDate(sub.createdAt)}
                        </span>
                      </div>
                      <SubscriptionActions
                        subscriptionId={sub.id}
                        stripeSubscriptionId={sub.stripeSubscriptionId}
                        status={sub.status}
                        cancelAtPeriodEnd={sub.cancelAtPeriodEnd}
                        pausedAt={sub.pausedAt}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Inactive Subscriptions */}
        {inactiveSubscriptions.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4">Past Subscriptions</h2>
            <div className="space-y-4">
              {inactiveSubscriptions.map((sub) => (
                <Card key={sub.id} className="opacity-75">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">{sub.plan.name}</h3>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            {sub.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">Ended</div>
                            <div className="font-medium">{formatDate(sub.currentPeriodEnd)}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Duration</div>
                            <div className="font-medium">
                              {formatDate(sub.createdAt)} - {formatDate(sub.updatedAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No subscriptions */}
        {subscriptions.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                This member has no subscriptions in this business.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Internal Notes */}
        <div className="mt-6">
          <MemberNotes consumerId={consumer.id} notes={notes} />
        </div>
    </div>
  );
}

