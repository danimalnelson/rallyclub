import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";

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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {business.logoUrl && (
                <Image 
                  src={business.logoUrl} 
                  alt={business.name} 
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded object-cover" 
                  priority
                />
              )}
              <h1 className="text-2xl font-bold">{business.name}</h1>
            </div>
            <Link href={`/${slug}/portal`}>
              <Button variant="outline">Member Portal</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {business.name} Memberships
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join our community and enjoy exclusive benefits with flexible subscription plans.
          </p>
        </div>

        {/* Memberships & Plans */}
        {business.memberships.length === 0 ? (
          <div className="text-center py-12">
            <Card className="max-w-md mx-auto">
              <CardContent className="pt-6">
                <p className="text-muted-foreground">
                  No membership plans available at this time. Check back soon!
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-16">
            {business.memberships.map((membership) => (
              <div key={membership.id} className="space-y-6">
                {/* Membership Header */}
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-2">{membership.name}</h3>
                  {membership.description && (
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      {membership.description}
                    </p>
                  )}
                  {membership.billingAnchor === "NEXT_INTERVAL" && membership.cohortBillingDay && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Billing on day {membership.cohortBillingDay} of each cycle
                    </p>
                  )}
                </div>

                {/* Plans Grid */}
                {membership.plans.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No plans available in this membership.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {membership.plans.map((plan) => (
                      <Card key={plan.id} className="flex flex-col hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="text-2xl">{plan.name}</CardTitle>
                          {plan.description && (
                            <CardDescription className="line-clamp-2">
                              {plan.description}
                            </CardDescription>
                          )}
                        </CardHeader>
                        
                        <CardContent className="flex-1 space-y-4">
                          {/* Pricing */}
                          {plan.pricingType === "FIXED" && plan.basePrice ? (
                            <div className="border-y py-4">
                              <div className="text-4xl font-bold">
                                {formatCurrency(plan.basePrice, plan.currency)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                per {plan.intervalCount > 1 && `${plan.intervalCount} `}
                                {plan.interval.toLowerCase()}
                                {plan.intervalCount > 1 && 's'}
                              </div>
                            </div>
                          ) : (
                            <div className="border-y py-4">
                              <div className="text-2xl font-bold text-muted-foreground">
                                Dynamic Pricing
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Price varies by selection
                              </div>
                            </div>
                          )}

                          {/* Features */}
                          <div className="space-y-2">
                            {plan.quantityPerShipment && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-primary">✓</span>
                                <span>{plan.quantityPerShipment} {plan.productType || 'items'} per shipment</span>
                              </div>
                            )}
                            {plan.trialPeriodDays && plan.trialPeriodDays > 0 && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-primary">✓</span>
                                <span>{plan.trialPeriodDays}-day free trial</span>
                              </div>
                            )}
                            {plan.shippingType === "INCLUDED" && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-primary">✓</span>
                                <span>Free shipping included</span>
                              </div>
                            )}
                            {plan.minimumCommitmentMonths && plan.minimumCommitmentMonths > 0 && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>•</span>
                                <span>{plan.minimumCommitmentMonths} month minimum</span>
                              </div>
                            )}
                          </div>

                          {/* Stock Status */}
                          {plan.stockStatus !== "AVAILABLE" && (
                            <div className="pt-2">
                              {plan.stockStatus === "SOLD_OUT" && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Sold Out
                                </span>
                              )}
                              {plan.stockStatus === "WAITLIST" && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Waitlist Only
                                </span>
                              )}
                              {plan.stockStatus === "COMING_SOON" && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  Coming Soon
                                </span>
                              )}
                            </div>
                          )}
                        </CardContent>

                        <CardFooter className="flex flex-col gap-2">
                          <Link href={`/${slug}/plans/${plan.id}`} className="w-full">
                            <Button 
                              className="w-full" 
                              disabled={plan.stockStatus === "SOLD_OUT" || plan.stockStatus === "COMING_SOON"}
                            >
                              {plan.stockStatus === "SOLD_OUT" ? "Sold Out" : 
                               plan.stockStatus === "COMING_SOON" ? "Coming Soon" :
                               plan.stockStatus === "WAITLIST" ? "Join Waitlist" : 
                               "Subscribe Now"}
                            </Button>
                          </Link>
                          {plan.setupFee && plan.setupFee > 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                              + {formatCurrency(plan.setupFee, plan.currency)} setup fee
                            </p>
                          )}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t mt-16 bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground space-y-2">
            <p>© {new Date().getFullYear()} {business.name}. All rights reserved.</p>
            <div className="flex items-center justify-center gap-4">
              <Link href={`/${slug}/portal`} className="hover:text-foreground">
                Member Portal
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
