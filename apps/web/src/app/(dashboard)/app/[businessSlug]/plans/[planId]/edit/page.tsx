import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { PlanForm } from "@/components/plans/PlanForm";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ businessSlug: string; planId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug, planId } = await params;

  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    notFound();
  }

  // Run plan and memberships queries in parallel
  const [plan, memberships] = await Promise.all([
    prisma.plan.findFirst({
      where: { id: planId, businessId: business.id },
    }),
    prisma.membership.findMany({
      where: {
        businessId: business.id,
        status: { in: ["DRAFT", "ACTIVE"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!plan) {
    notFound();
  }

  // Convert plan data for form (cents to dollars)
  const initialData = {
    membershipId: plan.membershipId,
    name: plan.name,
    description: plan.description || "",
    pricingType: plan.pricingType,
    basePrice: plan.basePrice ? (plan.basePrice / 100).toString() : "",
    currency: plan.currency,
    interval: "MONTH" as const,  // All plans are monthly now
    intervalCount: 1,  // Always 1 for monthly
    setupFee: plan.setupFee ? (plan.setupFee / 100).toString() : "",
    recurringFee: plan.recurringFee ? (plan.recurringFee / 100).toString() : "",
    recurringFeeName: plan.recurringFeeName || "",
    shippingFee: plan.shippingFee ? (plan.shippingFee / 100).toString() : "",
    stockStatus: plan.stockStatus,
    maxSubscribers: plan.maxSubscribers?.toString() || "",
    status: plan.status,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground mb-1">Edit Plan</h1>
            <p className="text-sm text-muted-foreground">{plan.name}</p>
          </div>
          <Link href={`/app/${business.slug}/plans`}>
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to Plans
            </button>
          </Link>
        </div>
      </div>
      <PlanForm
        businessId={business.id}
        memberships={memberships}
        initialData={initialData}
        planId={planId}
      />
    </div>
  );
}

