import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";

export default async function BusinessDashboardPage({
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
    include: {
      users: {
        where: {
          userId: session.user.id,
        },
      },
      _count: {
        select: {
          members: true,
          membershipPlans: true,
        },
      },
    },
  });

  if (!business) {
    notFound();
  }

  // Get active members
  const activeMembers = await prisma.member.count({
    where: {
      businessId: business.id,
      status: "ACTIVE",
    },
  });

  // Get active subscriptions and calculate MRR
  const activeSubscriptions = await prisma.subscription.findMany({
    where: {
      member: {
        businessId: business.id,
      },
      status: {
        in: ["active", "trialing"],
      },
    },
    include: {
      price: true,
    },
  });

  const mrr = activeSubscriptions.reduce((sum: number, sub: any) => {
    const monthlyAmount = sub.price.interval === "year"
      ? sub.price.unitAmount / 12
      : sub.price.unitAmount;
    return sum + monthlyAmount;
  }, 0);

  // Get failed invoices in last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const pastDueMembers = await prisma.member.count({
    where: {
      businessId: business.id,
      status: "PAST_DUE",
      updatedAt: {
        gte: sevenDaysAgo,
      },
    },
  });

  const publicAppUrl = process.env.PUBLIC_APP_URL || "http://localhost:3000";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              {business.logoUrl && (
                <img src={business.logoUrl} alt={business.name} className="h-12 w-12 rounded" />
              )}
              <div>
                <h1 className="text-2xl font-bold">{business.name}</h1>
                <p className="text-sm text-muted-foreground">@{business.slug}</p>
              </div>
            </div>
            <Link href="/app">
              <button className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Businesses
              </button>
            </Link>
          </div>
          
          <nav className="flex gap-6">
            <Link href={`/app/${business.id}`} className="text-sm font-medium border-b-2 border-primary pb-2">
              Overview
            </Link>
            <Link href={`/app/${business.id}/plans`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
              Plans
            </Link>
            <Link href={`/app/${business.id}/members`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
              Members
            </Link>
            <Link href={`/app/${business.id}/transactions`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
              Transactions
            </Link>
            <Link href={`/app/${business.id}/settings`} className="text-sm text-muted-foreground hover:text-foreground pb-2">
              Settings
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!business.stripeAccountId && (
          <Card className="mb-8 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
            <CardHeader>
              <CardTitle>Complete Stripe Setup</CardTitle>
              <CardDescription>
                Connect your Stripe account to start accepting payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={`/app/${business.id}/settings`}>
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                  Connect Stripe
                </button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardDescription>Monthly Recurring Revenue</CardDescription>
              <CardTitle className="text-3xl">
                {formatCurrency(Math.round(mrr), business.currency)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                From {activeSubscriptions.length} active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Active Members</CardDescription>
              <CardTitle className="text-3xl">{activeMembers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Total members: {business._count.members}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Failed Payments (7d)</CardDescription>
              <CardTitle className="text-3xl">{pastDueMembers}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/app/${business.id}/plans`} className="block">
                <button className="w-full text-left px-4 py-3 border rounded-md hover:bg-accent">
                  <div className="font-medium">Manage Plans</div>
                  <div className="text-sm text-muted-foreground">
                    {business._count.membershipPlans} plans created
                  </div>
                </button>
              </Link>
              <Link href={`/app/${business.id}/members`} className="block">
                <button className="w-full text-left px-4 py-3 border rounded-md hover:bg-accent">
                  <div className="font-medium">View Members</div>
                  <div className="text-sm text-muted-foreground">
                    {business._count.members} total members
                  </div>
                </button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public Page</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share your public page with customers:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${publicAppUrl}/${business.slug}`}
                  readOnly
                  className="flex-1 px-3 py-2 border rounded-md bg-muted text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${publicAppUrl}/${business.slug}`);
                  }}
                  className="px-4 py-2 border rounded-md hover:bg-accent"
                >
                  Copy
                </button>
              </div>
              <a
                href={`${publicAppUrl}/${business.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-primary hover:underline"
              >
                View public page →
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

