import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";

export default async function BusinessLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const business = await prisma.business.findUnique({
    where: { slug },
    include: {
      membershipPlans: {
        where: { status: "ACTIVE" },
        include: {
          prices: {
            where: { isDefault: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {business.logoUrl && (
                <img src={business.logoUrl} alt={business.name} className="h-12 w-12 rounded" />
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
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Join Our Wine Club</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover exceptional wines curated just for you. Choose the membership that fits your lifestyle.
          </p>
        </div>

        {business.membershipPlans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No membership plans available at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {business.membershipPlans.map((plan) => {
              const defaultPrice = plan.prices[0];
              const benefits = Array.isArray(plan.benefits)
                ? plan.benefits
                : (plan.benefits as any)?.items || [];

              return (
                <Card key={plan.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {defaultPrice && (
                      <div className="mb-6">
                        <div className="text-3xl font-bold">
                          {formatCurrency(defaultPrice.unitAmount, defaultPrice.currency)}
                        </div>
                        <div className="text-muted-foreground">
                          per {defaultPrice.interval}
                        </div>
                      </div>
                    )}
                    {benefits.length > 0 && (
                      <ul className="space-y-2">
                        {benefits.map((benefit: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-primary mt-1">✓</span>
                            <span className="text-sm">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Link href={`/${slug}/plans/${plan.id}`} className="w-full">
                      <Button className="w-full">View Details</Button>
                    </Link>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {business.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

