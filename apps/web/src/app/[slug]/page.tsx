import { notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { BusinessPhotos } from "@/components/business/BusinessPhotos";
import { MembershipListing } from "@/components/business/MembershipListing";
import { FloatingManageButton } from "@/components/business/FloatingManageButton";

// Force dynamic rendering to fetch fresh data on each request
export const dynamic = "force-dynamic";

export default async function BusinessLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          plans: {
            where: { status: "ACTIVE" },
            orderBy: [
              { displayOrder: "asc" },
              { basePrice: "asc" },
            ],
          },
        },
        orderBy: [
          { displayOrder: "asc" },
          { createdAt: "desc" },
        ],
      },
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Business name with manage button */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-semibold">
            {business.name}
          </h1>
          <FloatingManageButton businessSlug={slug} />
        </div>

        <BusinessPhotos
          businessName={business.name}
          photos={[]} // Add business.photos when available in schema
        />

        {business.description && (
          <p className="text-lg leading-[1.5rem] text-muted-foreground text-pretty mt-6 md:mt-8">
            {business.description}
          </p>
        )}
      </div>

      <MembershipListing
        businessName={business.name}
        businessSlug={slug}
        businessDescription={business.description || undefined}
        memberships={business.memberships}
      />
    </main>
  );
}
