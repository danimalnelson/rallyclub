import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import { PlansAndMembershipsTable } from "@/components/plans/PlansAndMembershipsTable";
import PlansLoading from "./loading";

async function PlansContent({
  businessId,
  businessSlug,
}: {
  businessId: string;
  businessSlug: string;
}) {
  const memberships = await prisma.membership.findMany({
    where: { businessId },
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
    take: 200,
  });

  const groups = memberships.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    slug: m.slug,
    status: m.status,
    billingInterval: m.billingInterval,
    billingAnchor: m.billingAnchor,
    cohortBillingDay: m.cohortBillingDay,
    chargeImmediately: m.chargeImmediately,
    allowMultiplePlans: m.allowMultiplePlans,
    maxMembers: m.maxMembers,
    giftEnabled: m.giftEnabled,
    waitlistEnabled: m.waitlistEnabled,
    membersOnlyAccess: m.membersOnlyAccess,
    pauseEnabled: m.pauseEnabled,
    skipEnabled: m.skipEnabled,
    benefits: m.benefits,
    displayOrder: m.displayOrder,
    plans: m.plans.map((plan) => ({
      id: plan.id,
      membershipId: m.id,
      name: plan.name,
      description: plan.description || "",
      status: plan.status,
      price: plan.basePrice,
      currency: plan.currency,
      pricingType: plan.pricingType,
      setupFee: plan.setupFee,
      recurringFee: plan.recurringFee,
      recurringFeeName: plan.recurringFeeName,
      shippingFee: plan.shippingFee,
      stockStatus: plan.stockStatus,
      maxSubscribers: plan.maxSubscribers,
      subscriptionCount: plan._count.planSubscriptions,
    })),
  }));

  return (
    <PlansAndMembershipsTable
      groups={groups}
      businessId={businessId}
      businessSlug={businessSlug}
    />
  );
}

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

  return (
    <div className="max-w-7xl mx-auto">
      <Suspense fallback={<PlansLoading />}>
        <PlansContent businessId={business.id} businessSlug={business.slug} />
      </Suspense>
    </div>
  );
}
