import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LinearLayout } from "@/components/linear-layout";
import { BusinessProvider } from "@/contexts/business-context";
import { getBusinessBySlug, getUserBusinesses } from "@/lib/data/business";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessSlug: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessSlug } = await params;

  // Run both queries in parallel
  const [business, allBusinesses] = await Promise.all([
    getBusinessBySlug(businessSlug, session.user.id),
    getUserBusinesses(session.user.id),
  ]);

  if (!business) {
    notFound();
  }

  return (
    <BusinessProvider businessId={business.id} businessSlug={business.slug}>
      <LinearLayout
        businessId={business.id}
        business={business}
        allBusinesses={allBusinesses}
        userEmail={session.user.email || undefined}
      >
        {children}
      </LinearLayout>
    </BusinessProvider>
  );
}
