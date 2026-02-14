"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import AvatarEditor from "react-avatar-editor";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wine-club/ui";
import { CloudUpload, MagnifyingGlassPlus, MagnifyingGlassMinus } from "geist-icons";
import { Cross } from "@/components/icons/Cross";
import { useBusinessContext } from "@/contexts/business-context";

export default function SettingsPage() {
  const { businessId } = useBusinessContext();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop modal state
  const editorRef = useRef<AvatarEditor | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);

  const [formData, setFormData] = useState({
    name: "",
    logoUrl: "",
    description: "",
    website: "",
    contactEmail: "",
    contactPhone: "",
    timeZone: "America/New_York",
  });

  // Step 1: File selected -> open crop modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ALLOWED_TYPES = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Accepted formats: PNG, JPEG, WebP, GIF");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File must be under 5MB");
      return;
    }

    setUploadError("");
    setCropFile(file);
    setZoom(1);

    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Step 2: Crop confirmed -> export from editor canvas -> upload
  const handleCropConfirm = async () => {
    if (!editorRef.current) return;

    // Get the cropped square canvas directly from the editor
    const canvas = editorRef.current.getImageScaledToCanvas();
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
        "image/png"
      );
    });

    setUploading(true);
    setCropFile(null);

    try {
      const body = new FormData();
      body.append("file", blob, "logo.png");
      body.append("businessId", businessId);
      if (formData.logoUrl) {
        body.append("oldUrl", formData.logoUrl);
      }

      const res = await fetch("/api/upload", { method: "POST", body });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await res.json();
      setFormData((prev) => ({ ...prev, logoUrl: url }));
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const cancelCrop = () => {
    setCropFile(null);
  };

  const removeLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: "" }));
    setUploadError("");
  };

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
      router.refresh(); // Re-fetch server data so sidebar logo updates
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

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Logo</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
              />

              {formData.logoUrl ? (
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <img
                      src={formData.logoUrl}
                      alt="Logo preview"
                      className="h-20 w-20 rounded-lg object-cover border border-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/40 transition-colors cursor-pointer"
                    >
                      <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Change
                      </span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex items-center gap-1 text-xs text-neutral-800 hover:text-neutral-950 transition-colors"
                  >
                    <Cross size={12} className="h-3 w-3" />
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 w-20 h-20 rounded-lg border border-dashed border-neutral-700 hover:border-neutral-800 bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  {uploading ? (
                    <div className="h-5 w-5 border-2 border-neutral-700 border-t-neutral-950 rounded-full animate-spin" />
                  ) : (
                    <CloudUpload className="h-5 w-5 text-neutral-800" />
                  )}
                </button>
              )}

              {uploading && (
                <p className="mt-2 text-xs text-muted-foreground">Uploading...</p>
              )}
              {uploadError && (
                <p className="mt-2 text-xs text-red-600">{uploadError}</p>
              )}
            </div>

            {/* Crop Modal */}
            {cropFile && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-white rounded-xl shadow-xl w-[420px] overflow-hidden">
                  <div className="flex items-center justify-center bg-neutral-100 p-4">
                    <AvatarEditor
                      ref={editorRef}
                      image={cropFile}
                      width={340}
                      height={340}
                      border={0}
                      borderRadius={0}
                      scale={zoom}
                      rotate={0}
                      backgroundColor="var(--ds-background-200)"
                    />
                  </div>
                  <div className="px-4 py-3 flex items-center gap-3">
                    <MagnifyingGlassMinus className="h-3.5 w-3.5 text-neutral-800 shrink-0" />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 accent-neutral-950"
                    />
                    <MagnifyingGlassPlus className="h-3.5 w-3.5 text-neutral-800 shrink-0" />
                  </div>
                  <div className="px-4 py-3 border-t border-neutral-400 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={cancelCrop}
                      className="text-sm font-medium text-neutral-900 hover:text-neutral-950 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCropConfirm}
                      className="px-4 h-9 rounded-lg bg-neutral-950 text-white text-sm font-medium hover:bg-neutral-925 transition-colors"
                    >
                      Set Logo
                    </button>
                  </div>
                </div>
              </div>
            )}

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

