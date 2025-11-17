import { notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { BusinessHeader } from "@/components/business/BusinessHeader";
import { BusinessPhotos } from "@/components/business/BusinessPhotos";
import { MembershipListing } from "@/components/business/MembershipListing";

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
      <BusinessHeader
        businessName={business.name}
        businessSlug={slug}
      />

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <BusinessPhotos
          businessName={business.name}
          photos={[]} // Add business.photos when available in schema
        />
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
