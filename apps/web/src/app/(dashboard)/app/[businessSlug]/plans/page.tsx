import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import { PlansTable } from "@/components/plans/PlansTable";

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

  // Stripe not connected
  if (!business.stripeAccountId) {
    return (
      <div className="max-w-7xl mx-auto">
        <Card className="border-yellow-500 bg-yellow-50">
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
      </div>
    );
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

  // No memberships yet
  if (memberships.length === 0) {
    return (
      <div className="max-w-7xl mx-auto">
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
      </div>
    );
  }

  // Flatten plans with membership context
  const plans = memberships.flatMap((membership) =>
    membership.plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      status: plan.status,
      membershipName: membership.name,
      price: plan.basePrice,
      currency: plan.currency,
      pricingType: plan.pricingType,
      frequency: membership.billingInterval,
      subscriptionCount: plan._count.planSubscriptions,
    }))
  );

  const allMembershipNames = [...new Set(memberships.map((m) => m.name))].sort();

  return (
    <div className="max-w-7xl mx-auto">
      <PlansTable
        plans={plans}
        allMembershipNames={allMembershipNames}
        businessSlug={business.slug}
      />
    </div>
  );
}
