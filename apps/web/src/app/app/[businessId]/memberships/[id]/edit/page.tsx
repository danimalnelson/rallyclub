import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { MembershipForm } from "@/components/memberships/MembershipForm";

export default async function EditMembershipPage({
  params,
}: {
  params: Promise<{ businessId: string; id: string }>;
}) {
  const { businessId, id } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verify business access
  const businessAccess = await prisma.businessUser.findFirst({
    where: {
      businessId,
      userId: session.user.id,
    },
  });

  if (!businessAccess) {
    return notFound();
  }

  // Fetch membership
  const membershipData = await prisma.membership.findUnique({
    where: { id, businessId },
  });

  if (!membershipData) {
    return notFound();
  }

  // Convert to plain object for client component (serialize dates)
  const membership = {
    id: membershipData.id,
    name: membershipData.name,
    description: membershipData.description,
    slug: membershipData.slug,
    billingInterval: membershipData.billingInterval,
    billingAnchor: membershipData.billingAnchor,
    cohortBillingDay: membershipData.cohortBillingDay,
    chargeImmediately: membershipData.chargeImmediately,
    allowMultiplePlans: membershipData.allowMultiplePlans,
    maxMembers: membershipData.maxMembers,
    status: membershipData.status,
    giftEnabled: membershipData.giftEnabled,
    waitlistEnabled: membershipData.waitlistEnabled,
    membersOnlyAccess: membershipData.membersOnlyAccess,
    pauseEnabled: membershipData.pauseEnabled,
    skipEnabled: membershipData.skipEnabled,
    benefits: membershipData.benefits,
    displayOrder: membershipData.displayOrder,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <MembershipForm businessId={businessId} membership={membership} />
      </div>
    </div>
  );
}

