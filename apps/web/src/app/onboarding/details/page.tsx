"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

export default function OnboardingDetailsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    country: "US",
    currency: "USD",
    timeZone: "America/New_York",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/business/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create business");
      }

      // Redirect to Stripe Connect step
      router.push(`/onboarding/connect?businessId=${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      // Auto-generate slug from name
      slug: name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50)
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                1
              </div>
              <span className="text-sm font-medium">Business Details</span>
            </div>
            <div className="w-12 h-0.5 bg-muted-foreground/30"></div>
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center font-semibold">
                2
              </div>
              <span className="text-sm">Connect Stripe</span>
            </div>
            <div className="w-12 h-0.5 bg-muted-foreground/30"></div>
            <div className="flex items-center gap-2 opacity-50">
              <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center font-semibold">
                3
              </div>
              <span className="text-sm">Complete</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome to Vintigo! 🍷</CardTitle>
            <CardDescription>
              Let&apos;s set up your business so you can start selling wine club memberships
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Business Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Ruby Tap Wine Bar"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The name of your wine bar, shop, or business
                </p>
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium mb-2">
                  URL Slug *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">vintigo.com/</span>
                  <input
                    id="slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    required
                    pattern="[a-z0-9-]+"
                    className="flex-1 px-3 py-2 border rounded-md"
                    placeholder="ruby-tap"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  This will be your public page URL (lowercase, letters and hyphens only)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="country" className="block text-sm font-medium mb-2">
                    Country *
                  </label>
                  <select
                    id="country"
                    value={formData.country}
                    onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="currency" className="block text-sm font-medium mb-2">
                    Currency *
                  </label>
                  <select
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-between items-center pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => signOut({ callbackUrl: "/" })}
                >
                  Sign Out
                </Button>
                <Button type="submit" disabled={loading} className="min-w-32">
                  {loading ? "Creating..." : "Continue"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

