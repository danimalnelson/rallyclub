"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

export default function MemberPortalPage() {
  const params = useParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleOpenPortal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/portal/${params.slug}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumerEmail: email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to open portal");
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Member Portal</CardTitle>
          <CardDescription>
            Enter your email to manage your membership, update payment methods, or cancel your subscription.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOpenPortal} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Opening portal..." : "Access Member Portal"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

