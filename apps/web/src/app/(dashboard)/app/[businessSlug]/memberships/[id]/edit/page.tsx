import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { MembershipForm } from "@/components/memberships/MembershipForm";

export default async function EditMembershipPage({
  params,
}: {
  params: Promise<{ businessSlug: string; id: string }>;
}) {
  const { businessSlug, id } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const business = await getBusinessBySlug(businessSlug, session.user.id);

  if (!business) {
    return notFound();
  }

  // Fetch membership (business lookup was deduplicated via cache)
  const membershipData = await prisma.membership.findUnique({
    where: { id, businessId: business.id },
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
    <div className="max-w-4xl mx-auto">
      <MembershipForm businessId={business.id} membership={membership} />
    </div>
  );
}

