import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import { ArrowLeft } from "geist-icons";

export const revalidate = 300;

export default async function PlanDetailsPage({
  params,
}: {
  params: Promise<{ slug: string; planId: string }>;
}) {
  const { slug, planId } = await params;
  
  const plan = await prisma.plan.findFirst({
    where: { 
      id: planId,
      status: "ACTIVE",
      membership: {
        status: "ACTIVE",
        business: {
          slug,
        },
      },
    },
    include: {
      membership: {
        include: {
          business: true,
        },
      },
    },
  });

  if (!plan) {
    notFound();
  }

  const business = plan.membership.business;

  // Parse images if stored as JSON
  let images: string[] = [];
  if (plan.images) {
    try {
      images = Array.isArray(plan.images) ? plan.images as string[] : [];
    } catch (e) {
      // Ignore parsing errors
    }
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
              <Button type="secondary">Member Portal</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Link 
          href={`/${slug}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all plans
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Left Column: Images & Details */}
          <div className="space-y-6">
            {/* Images */}
            {images.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="relative aspect-square overflow-hidden rounded-lg">
                    <Image 
                      src={images[0]} 
                      alt={plan.name}
                      fill
                      className="object-cover"
                      priority
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {images.slice(1, 5).map((img, idx) => (
                        <div key={idx} className="relative aspect-square overflow-hidden rounded">
                          <Image 
                            src={img} 
                            alt={`${plan.name} ${idx + 2}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Plan Details */}
            <Card>
              <CardHeader>
                <CardTitle>What's Included</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="text-primary text-xl">✓</span>
                  <div>
                    <p className="font-medium">Recurring Subscription</p>
                    <p className="text-sm text-muted-foreground">
                      Billed {plan.membership.billingInterval.toLowerCase()}ly
                    </p>
                  </div>
                </div>

                {plan.shippingFee && plan.shippingFee > 0 && (
                  <div className="flex items-start gap-3">
                    <span className="text-primary text-xl">✓</span>
                    <div>
                      <p className="font-medium">
                        {formatCurrency(plan.shippingFee, plan.currency)} Flat Rate Shipping
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Per shipment
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {plan.description && (
              <Card>
                <CardHeader>
                  <CardTitle>About This Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {plan.description}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Purchase Card */}
          <div>
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-3xl mb-2">{plan.name}</CardTitle>
                    <CardDescription className="text-base">
                      {plan.membership.name} Membership
                    </CardDescription>
                  </div>
                  {plan.stockStatus !== "AVAILABLE" && (
                    <div>
                      {plan.stockStatus === "SOLD_OUT" && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Sold Out
                        </span>
                      )}
                      {plan.stockStatus === "WAITLIST" && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Waitlist
                        </span>
                      )}
                      {plan.stockStatus === "COMING_SOON" && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Pricing */}
                <div className="border rounded-lg p-6 bg-muted/50">
                  {plan.pricingType === "FIXED" && plan.basePrice ? (
                    <>
                      <div className="text-5xl font-bold mb-2">
                        {formatCurrency(plan.basePrice, plan.currency)}
                      </div>
                      <div className="text-muted-foreground">
                        per {plan.membership.billingInterval.toLowerCase()}
                      </div>
                      {plan.setupFee && plan.setupFee > 0 && (
                        <div className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                          + {formatCurrency(plan.setupFee, plan.currency)} one-time setup fee
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-bold mb-2 text-muted-foreground">
                        Dynamic Pricing
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Final price determined at checkout based on your selections
                      </div>
                    </>
                  )}
                </div>

                {/* Important Details */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Billing Frequency</span>
                    <span className="font-medium capitalize">
                      Billed {plan.membership.billingInterval.toLowerCase()}ly
                    </span>
                  </div>
                  {plan.membership.billingAnchor === "NEXT_INTERVAL" && plan.membership.cohortBillingDay && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Billing Day</span>
                      <span className="font-medium">Day {plan.membership.cohortBillingDay} of cycle</span>
                    </div>
                  )}
                  {plan.maxSubscribers && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Spots Available</span>
                      <span className="font-medium">Limited to {plan.maxSubscribers} members</span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Button 
                  size="large"
                  className="w-full text-lg h-14"
                  disabled={plan.stockStatus === "SOLD_OUT" || plan.stockStatus === "COMING_SOON"}
                  asChild={plan.stockStatus === "AVAILABLE" || plan.stockStatus === "WAITLIST"}
                >
                  {plan.stockStatus === "AVAILABLE" || plan.stockStatus === "WAITLIST" ? (
                    <Link href={`/${slug}/plans/${plan.id}/checkout`}>
                      {plan.stockStatus === "WAITLIST" ? "Join Waitlist" : "Subscribe Now"}
                    </Link>
                  ) : (
                    <span>
                      {plan.stockStatus === "SOLD_OUT" ? "Sold Out" : "Coming Soon"}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

