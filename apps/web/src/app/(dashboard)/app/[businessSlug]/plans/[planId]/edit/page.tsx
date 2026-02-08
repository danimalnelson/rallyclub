import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { PlanForm } from "@/components/plans/PlanForm";
import { ArrowLeft } from "lucide-react";

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
      <div className="mb-6 flex items-center gap-3">
        <Link href={`/app/${business.slug}/plans`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-sm font-medium text-foreground">{plan.name}</span>
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

