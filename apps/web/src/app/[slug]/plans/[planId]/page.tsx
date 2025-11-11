"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";

interface Price {
  id: string;
  nickname: string | null;
  interval: string;
  unitAmount: number;
  currency: string;
  isDefault: boolean;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  benefits: any;
  prices: Price[];
}

interface Business {
  name: string;
  slug: string;
  logoUrl: string | null;
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/embed/${params.slug}/plans`);
        if (!res.ok) throw new Error("Failed to fetch plans");
        
        const data = await res.json();
        const foundPlan = data.plans.find((p: Plan) => p.id === params.planId);
        
        if (!foundPlan) {
          setError("Plan not found");
          return;
        }

        setPlan(foundPlan);
        setBusiness(data.business);
        
        // Set default price
        const defaultPrice = foundPlan.prices.find((p: Price) => p.isDefault) || foundPlan.prices[0];
        if (defaultPrice) {
          setSelectedPriceId(defaultPrice.id);
        }
      } catch (err) {
        setError("Failed to load plan details");
      }
    }

    fetchPlan();
  }, [params.slug, params.planId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPriceId) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/checkout/${params.slug}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: selectedPriceId,
          consumerEmail: email || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create checkout session");
      }

      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (error && !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push(`/${params.slug}`)}>Go Back</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!plan || !business) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const benefits = Array.isArray(plan.benefits)
    ? plan.benefits
    : (plan.benefits as any)?.items || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            {business.logoUrl && (
              <img src={business.logoUrl} alt={business.name} className="h-12 w-12 rounded" />
            )}
            <h1 className="text-2xl font-bold">{business.name}</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${params.slug}`)}
            className="mb-6"
          >
            ← Back to Plans
          </Button>

          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">{plan.name}</CardTitle>
              <CardDescription className="text-lg">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {benefits.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">What's Included:</h3>
                  <ul className="space-y-2">
                    {benefits.map((benefit: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-1">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-3">Choose Your Plan:</h3>
                <div className="space-y-2">
                  {plan.prices.map((price: any) => (
                    <label
                      key={price.id}
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition ${
                        selectedPriceId === price.id
                          ? "border-primary bg-primary/5"
                          : "hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="price"
                          value={price.id}
                          checked={selectedPriceId === price.id}
                          onChange={(e) => setSelectedPriceId(e.target.value)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="font-medium">
                            {price.nickname || `${price.interval}ly`}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Billed {price.interval}ly
                          </div>
                        </div>
                      </div>
                      <div className="text-xl font-bold">
                        {formatCurrency(price.unitAmount, price.currency)}
                        <span className="text-sm text-muted-foreground font-normal">
                          /{price.interval}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email (optional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    We&apos;ll send your membership details to this email
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Processing..." : "Join Now"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

