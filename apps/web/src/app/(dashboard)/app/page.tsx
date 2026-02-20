import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { checkSuperAdmin } from "@/lib/data/business";

export default async function AppHomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const superAdmin = await checkSuperAdmin(session.user.id);

  const businesses = await prisma.business.findMany({
    where: superAdmin
      ? { status: "ONBOARDING_COMPLETE" }
      : { users: { some: { userId: session.user.id } } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      status: true,
      stripeAccountId: true,
    },
  });

  if (businesses.length === 0) {
    redirect("/onboarding");
  }

  if (!superAdmin) {
    const onboardingBusiness = businesses.find(
      (business) => business.status !== "ONBOARDING_COMPLETE"
    );

    if (onboardingBusiness) {
      if (!onboardingBusiness.stripeAccountId) {
        redirect(`/onboarding/connect?businessId=${onboardingBusiness.id}`);
      }

      if (onboardingBusiness.status !== "ONBOARDING_COMPLETE") {
        redirect(`/onboarding/success?businessId=${onboardingBusiness.id}`);
      }
    }
  }

  const mostRecent = businesses[0];
  redirect(`/app/${mostRecent.slug}`);
}
