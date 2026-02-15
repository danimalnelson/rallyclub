"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wine-club/ui";
import { useBusinessContext } from "@/contexts/business-context";

export default function BrandingPage() {
  const { businessId } = useBusinessContext();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    brandColorPrimary: "#6366f1",
    brandColorSecondary: "",
  });

  useEffect(() => {
    const fetchBusiness = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/business/${businessId}`);
        if (!res.ok) throw new Error("Failed to fetch business");
        const data = await res.json();

        setFormData({
          brandColorPrimary: data.brandColorPrimary || "#6366f1",
          brandColorSecondary: data.brandColorSecondary || "",
        });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [businessId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`/api/business/${businessId}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update branding");
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading branding...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Customize the colors used across your membership pages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Primary Brand Color */}
            <div>
              <label
                htmlFor="brandColorPrimary"
                className="block text-sm font-medium mb-2"
              >
                Primary Brand Color
              </label>
              <div className="flex gap-2">
                <input
                  id="brandColorPrimary"
                  type="color"
                  className="h-10 w-20"
                  value={formData.brandColorPrimary}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      brandColorPrimary: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border rounded-md font-mono text-sm"
                  value={formData.brandColorPrimary}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      brandColorPrimary: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Secondary Brand Color */}
            <div>
              <label
                htmlFor="brandColorSecondary"
                className="block text-sm font-medium mb-2"
              >
                Secondary Brand Color
              </label>
              <div className="flex gap-2">
                <input
                  id="brandColorSecondary"
                  type="color"
                  className="h-10 w-20"
                  value={formData.brandColorSecondary || "#000000"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      brandColorSecondary: e.target.value,
                    })
                  }
                />
                <input
                  type="text"
                  className="flex-1 px-3 py-2 border rounded-md font-mono text-sm"
                  placeholder="#000000"
                  value={formData.brandColorSecondary}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      brandColorSecondary: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-800">
            Branding updated successfully!
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="min-w-32">
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
