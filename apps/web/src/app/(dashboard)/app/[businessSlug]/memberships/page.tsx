import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { MembershipsTable } from "@/components/memberships/MembershipsTable";

export default async function MembershipsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    return notFound();
  }

  const memberships = await prisma.membership.findMany({
    where: { businessId: business.id },
    include: {
      plans: {
        select: {
          id: true,
          status: true,
        },
      },
      _count: {
        select: {
          plans: true,
        },
      },
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  const flatMemberships = memberships.map((m) => ({
    id: m.id,
    name: m.name,
    status: m.status,
    billingInterval: m.billingInterval,
    billingAnchor: m.billingAnchor,
    cohortBillingDay: m.cohortBillingDay,
    totalPlans: m._count.plans,
    activePlans: m.plans.filter((p) => p.status === "ACTIVE").length,
    maxMembers: m.maxMembers,
  }));

  return (
    <div className="max-w-7xl mx-auto">
      <MembershipsTable
        memberships={flatMemberships}
        businessId={business.id}
        businessSlug={business.slug}
      />
    </div>
  );
}
