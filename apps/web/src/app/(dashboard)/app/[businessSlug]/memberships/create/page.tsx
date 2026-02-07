import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { getBusinessBySlug } from "@/lib/data/business";
import { MembershipForm } from "@/components/memberships/MembershipForm";

export default async function CreateMembershipPage({
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

  return (
    <div className="max-w-4xl mx-auto">
      <MembershipForm businessId={business.id} />
    </div>
  );
}

