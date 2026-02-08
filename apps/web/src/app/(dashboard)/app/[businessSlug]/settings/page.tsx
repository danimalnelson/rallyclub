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

export default function SettingsPage() {
  const { businessId } = useBusinessContext();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    description: "",
    website: "",
    contactEmail: "",
    contactPhone: "",
    brandColorPrimary: "#6366f1",
    brandColorSecondary: "",
    timeZone: "America/New_York",
  });

  useEffect(() => {
    const fetchBusiness = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/business/${businessId}`);
        if (!res.ok) throw new Error("Failed to fetch business");
        const data = await res.json();

        setFormData({
          name: data.name || "",
          logoUrl: data.logoUrl || "",
          description: data.description || "",
          website: data.website || "",
          contactEmail: data.contactEmail || "",
          contactPhone: data.contactPhone || "",
          brandColorPrimary: data.brandColorPrimary || "#6366f1",
          brandColorSecondary: data.brandColorSecondary || "",
          timeZone: data.timeZone || "America/New_York",
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
        throw new Error(data.error || "Failed to update profile");
      }

      setSuccess(true);
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
        <p className="text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Profile</CardTitle>
            <CardDescription>
              Manage your business information and branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Business Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-2"
              >
                Business Name *
              </label>
              <input
                id="name"
                type="text"
                required
                className="w-full px-3 py-2 border rounded-md"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>

            {/* Logo URL */}
            <div>
              <label
                htmlFor="logoUrl"
                className="block text-sm font-medium mb-2"
              >
                Logo URL
              </label>
              <input
                id="logoUrl"
                type="url"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="https://example.com/logo.png"
                value={formData.logoUrl}
                onChange={(e) =>
                  setFormData({ ...formData, logoUrl: e.target.value })
                }
              />
              {formData.logoUrl && (
                <div className="mt-2">
                  <img
                    src={formData.logoUrl}
                    alt="Logo preview"
                    className="h-16 object-contain"
                  />
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                rows={4}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Tell customers about your wine club..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>

            {/* Website */}
            <div>
              <label
                htmlFor="website"
                className="block text-sm font-medium mb-2"
              >
                Website
              </label>
              <input
                id="website"
                type="url"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="https://yourwebsite.com"
                value={formData.website}
                onChange={(e) =>
                  setFormData({ ...formData, website: e.target.value })
                }
              />
            </div>

            {/* Contact Email */}
            <div>
              <label
                htmlFor="contactEmail"
                className="block text-sm font-medium mb-2"
              >
                Contact Email
              </label>
              <input
                id="contactEmail"
                type="email"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="support@yourwineclub.com"
                value={formData.contactEmail}
                onChange={(e) =>
                  setFormData({ ...formData, contactEmail: e.target.value })
                }
              />
            </div>

            {/* Contact Phone */}
            <div>
              <label
                htmlFor="contactPhone"
                className="block text-sm font-medium mb-2"
              >
                Contact Phone
              </label>
              <input
                id="contactPhone"
                type="tel"
                className="w-full px-3 py-2 border rounded-md"
                placeholder="+1234567890"
                value={formData.contactPhone}
                onChange={(e) =>
                  setFormData({ ...formData, contactPhone: e.target.value })
                }
              />
            </div>

            {/* Timezone */}
            <div>
              <label
                htmlFor="timeZone"
                className="block text-sm font-medium mb-2"
              >
                Timezone
              </label>
              <select
                id="timeZone"
                className="w-full px-3 py-2 border rounded-md bg-white"
                value={formData.timeZone}
                onChange={(e) =>
                  setFormData({ ...formData, timeZone: e.target.value })
                }
              >
                <optgroup label="US">
                  <option value="America/New_York">Eastern (New York)</option>
                  <option value="America/Chicago">Central (Chicago)</option>
                  <option value="America/Denver">Mountain (Denver)</option>
                  <option value="America/Los_Angeles">Pacific (Los Angeles)</option>
                  <option value="America/Anchorage">Alaska (Anchorage)</option>
                  <option value="Pacific/Honolulu">Hawaii (Honolulu)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Europe/Berlin">Berlin (CET)</option>
                </optgroup>
                <optgroup label="Asia/Pacific">
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Australia/Sydney">Sydney (AEST)</option>
                </optgroup>
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Used for displaying dates and times across the dashboard
              </p>
            </div>

            {/* Brand Colors */}
            <div className="grid grid-cols-2 gap-4">
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
            Profile updated successfully!
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

