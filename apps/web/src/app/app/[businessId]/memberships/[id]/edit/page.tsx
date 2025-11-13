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
  const membership = await prisma.membership.findUnique({
    where: { id, businessId },
  });

  if (!membership) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <MembershipForm businessId={businessId} membership={membership} />
      </div>
    </div>
  );
}

