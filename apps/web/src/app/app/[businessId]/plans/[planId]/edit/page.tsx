import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { PlanForm } from "@/components/plans/PlanForm";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ businessId: string; planId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessId, planId } = await params;

  // Get business and verify access
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

  // Get the plan
  const plan = await prisma.plan.findFirst({
    where: {
      id: planId,
      businessId: business.id,
    },
  });

  if (!plan) {
    notFound();
  }

  // Get memberships for dropdown
  const memberships = await prisma.membership.findMany({
    where: {
      businessId: business.id,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Convert plan data for form (cents to dollars)
  const initialData = {
    membershipId: plan.membershipId,
    name: plan.name,
    description: plan.description || "",
    pricingType: plan.pricingType,
    basePrice: plan.basePrice ? (plan.basePrice / 100).toString() : "",
    currency: plan.currency,
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    quantityPerShipment: plan.quantityPerShipment?.toString() || "",
    productType: plan.productType || "",
    setupFee: plan.setupFee ? (plan.setupFee / 100).toString() : "",
    shippingType: plan.shippingType,
    shippingCost: plan.shippingCost ? (plan.shippingCost / 100).toString() : "",
    trialPeriodDays: plan.trialPeriodDays?.toString() || "",
    minimumCommitmentMonths: plan.minimumCommitmentMonths?.toString() || "",
    stockStatus: plan.stockStatus,
    maxSubscribers: plan.maxSubscribers?.toString() || "",
    status: plan.status,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Edit Plan</h1>
              <p className="text-sm text-muted-foreground mt-1">{plan.name}</p>
            </div>
            <Link href={`/app/${business.id}/plans`}>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Plans
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PlanForm
          businessId={business.id}
          memberships={memberships}
          initialData={initialData}
          planId={planId}
        />
      </main>
    </div>
  );
}

