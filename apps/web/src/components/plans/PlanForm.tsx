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

interface Membership {
  id: string;
  name: string;
  billingAnchor: string;
  cohortBillingDay?: number | null;
  status: string;
}

interface MonthlyPrice {
  month: string; // "2025-11" format
  monthLabel: string; // "Nov 2025" display
  price: string; // In dollars
  isCurrent: boolean;
}

interface PlanFormData {
  membershipId: string;
  name: string;
  description: string;
  pricingType: "FIXED" | "DYNAMIC";
  basePrice: string; // In dollars for form (used for FIXED)
  monthlyPrices: MonthlyPrice[]; // Used for DYNAMIC
  currency: string;
  interval: "MONTH";
  intervalCount: number;
  setupFee: string;
  recurringFee: string;
  recurringFeeName: string;
  shippingFee: string;
  stockStatus: "AVAILABLE" | "SOLD_OUT" | "COMING_SOON" | "WAITLIST";
  maxSubscribers: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
}

interface PlanFormProps {
  businessId: string;
  memberships: Membership[];
  initialData?: Partial<PlanFormData>;
  planId?: string; // If editing
}

// Generate next N months starting from current month
function generateMonthlyPrices(count: number = 6): MonthlyPrice[] {
  const prices: MonthlyPrice[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const month = date.toISOString().slice(0, 7); // "2025-11"
    const monthLabel = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }); // "Nov 2025"
    
    prices.push({
      month,
      monthLabel,
      price: "",
      isCurrent: i === 0, // First month is current
    });
  }
  
  return prices;
}

export function PlanForm({
  businessId,
  memberships,
  initialData,
  planId,
}: PlanFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanFormData>({
    membershipId: initialData?.membershipId || memberships[0]?.id || "",
    name: initialData?.name || "",
    description: initialData?.description || "",
    pricingType: initialData?.pricingType || "FIXED",
    basePrice: initialData?.basePrice || "",
    monthlyPrices: initialData?.monthlyPrices || generateMonthlyPrices(6),
    currency: initialData?.currency || "usd",
    interval: initialData?.interval || "MONTH",
    intervalCount: initialData?.intervalCount || 1,
    setupFee: initialData?.setupFee || "",
    recurringFee: initialData?.recurringFee || "",
    recurringFeeName: initialData?.recurringFeeName || "",
    shippingFee: initialData?.shippingFee || "",
    stockStatus: initialData?.stockStatus || "AVAILABLE",
    maxSubscribers: initialData?.maxSubscribers || "",
    status: initialData?.status || "DRAFT",
  });

  const handlePricingTypeChange = (newType: "FIXED" | "DYNAMIC") => {
    setFormData({
      ...formData,
      pricingType: newType,
      // If switching to dynamic, regenerate monthly prices
      monthlyPrices: newType === "DYNAMIC" ? generateMonthlyPrices(6) : formData.monthlyPrices,
    });
  };

  const handleMonthlyPriceChange = (index: number, value: string) => {
    const newPrices = [...formData.monthlyPrices];
    newPrices[index].price = value;
    setFormData({ ...formData, monthlyPrices: newPrices });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate dynamic pricing has current month price
      if (formData.pricingType === "DYNAMIC") {
        const currentMonthPrice = formData.monthlyPrices[0];
        if (!currentMonthPrice.price || parseFloat(currentMonthPrice.price) <= 0) {
          throw new Error("Current month price is required for dynamic pricing");
        }
      }

      // Convert dollar amounts to cents
      const payload: any = {
        ...formData,
        basePrice: formData.basePrice
          ? Math.round(parseFloat(formData.basePrice) * 100)
          : null,
        setupFee: formData.setupFee
          ? Math.round(parseFloat(formData.setupFee) * 100)
          : null,
        recurringFee: formData.recurringFee
          ? Math.round(parseFloat(formData.recurringFee) * 100)
          : null,
        recurringFeeName: formData.recurringFee && parseFloat(formData.recurringFee) > 0 
          ? "Processing Fee" 
          : null,
        shippingFee: formData.shippingFee
          ? Math.round(parseFloat(formData.shippingFee) * 100)
          : null,
        maxSubscribers: formData.maxSubscribers
          ? parseInt(formData.maxSubscribers)
          : null,
      };

      // Add monthly prices for dynamic pricing (convert to cents)
      if (formData.pricingType === "DYNAMIC") {
        payload.monthlyPrices = formData.monthlyPrices
          .filter((mp) => mp.price && parseFloat(mp.price) > 0)
          .map((mp) => ({
            month: mp.month,
            price: Math.round(parseFloat(mp.price) * 100), // Convert to cents
            isCurrent: mp.isCurrent,
          }));
      }

      const url = planId
        ? `/api/plans/${planId}`
        : "/api/plans/create";
      const method = planId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save plan");
      }

      const data = await response.json();

      // Redirect to plans list
      router.push(`/app/${businessId}/plans`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Core details about this subscription plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="membershipId"
              className="block text-sm font-medium mb-2"
            >
              Membership *
            </label>
            <select
              id="membershipId"
              value={formData.membershipId}
              onChange={(e) =>
                setFormData({ ...formData, membershipId: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-md"
              required
            >
              <option value="">Select a membership</option>
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Plan Name *
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Monthly Red Wine Selection"
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe what's included in this plan..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium mb-2">
              Visibility
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={formData.status === "ACTIVE"}
                onClick={() =>
                  setFormData({
                    ...formData,
                    status: formData.status === "ACTIVE" ? "DRAFT" : "ACTIVE",
                  })
                }
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${formData.status === "ACTIVE" ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${formData.status === "ACTIVE" ? "translate-x-6" : "translate-x-1"}
                  `}
                />
              </button>
              <span className="text-sm">
                {formData.status === "ACTIVE" ? (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    Visible to customers
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Hidden from customers
                  </span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>
            Set how much and how often customers are charged
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="pricingType"
              className="block text-sm font-medium mb-2"
            >
              Pricing Type
            </label>
            <select
              id="pricingType"
              value={formData.pricingType}
              onChange={(e) =>
                handlePricingTypeChange(e.target.value as "FIXED" | "DYNAMIC")
              }
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="FIXED">Fixed (same price every interval)</option>
              <option value="DYNAMIC">Dynamic (price varies)</option>
            </select>
          </div>

          {formData.pricingType === "FIXED" && (
            <div>
              <label
                htmlFor="basePrice"
                className="block text-sm font-medium mb-2"
              >
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  id="basePrice"
                  value={formData.basePrice}
                  onChange={(e) =>
                    setFormData({ ...formData, basePrice: e.target.value })
                  }
                  placeholder="50.00"
                  step="0.01"
                  min="0"
                  className="w-full pl-7 pr-3 py-2 border rounded-md"
                  required
                />
              </div>
            </div>
          )}

          {formData.pricingType === "DYNAMIC" && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Monthly Price Schedule *
              </label>
              <p className="text-sm text-muted-foreground mb-4">
                Set your monthly pricing. The current month is required. If a month is blank, 
                the last set price will continue. Members will be notified 7 days before price changes.
              </p>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Month</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Price</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {formData.monthlyPrices.map((monthPrice, index) => (
                      <tr key={monthPrice.month} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{monthPrice.monthLabel}</span>
                            {monthPrice.isCurrent && (
                              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                              $
                            </span>
                            <input
                              type="number"
                              value={monthPrice.price}
                              onChange={(e) => handleMonthlyPriceChange(index, e.target.value)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              className={`w-full pl-7 pr-3 py-1.5 border rounded-md text-sm ${
                                monthPrice.isCurrent && !monthPrice.price
                                  ? "border-red-300 focus:border-red-500"
                                  : ""
                              }`}
                              required={monthPrice.isCurrent}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-muted-foreground">
                            {monthPrice.price ? (
                              monthPrice.isCurrent ? (
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  Active (required)
                                </span>
                              ) : (
                                "Scheduled"
                              )
                            ) : monthPrice.isCurrent ? (
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                Not set (plan unavailable)
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400">
                                Not set (required)
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!formData.monthlyPrices[0].price && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  ⚠️ Current month price is required to activate this plan
                </p>
              )}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-md">
            <p className="text-sm text-muted-foreground">
              <strong>Billing Frequency:</strong> All plans are billed <strong>monthly</strong>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Additional Fees */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Fees</CardTitle>
          <CardDescription>
            One-time and recurring charges
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="setupFee"
              className="block text-sm font-medium mb-2"
            >
              One-Time Setup Fee
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                id="setupFee"
                value={formData.setupFee}
                onChange={(e) =>
                  setFormData({ ...formData, setupFee: e.target.value })
                }
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-7 pr-3 py-2 border rounded-md"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Charged once at subscription start
            </p>
          </div>

          <div>
            <label
              htmlFor="recurringFee"
              className="block text-sm font-medium mb-2"
            >
              Processing Fee
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <input
                type="number"
                id="recurringFee"
                value={formData.recurringFee}
                onChange={(e) =>
                  setFormData({ 
                    ...formData, 
                    recurringFee: e.target.value,
                    recurringFeeName: "Processing Fee"
                  })
                }
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full pl-7 pr-3 py-2 border rounded-md"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Added to each billing cycle
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Inventory & Availability */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory & Availability</CardTitle>
          <CardDescription>
            Manage plan availability and subscriber limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label
              htmlFor="stockStatus"
              className="block text-sm font-medium mb-2"
            >
              Stock Status
            </label>
            <select
              id="stockStatus"
              value={formData.stockStatus}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stockStatus: e.target.value as PlanFormData["stockStatus"],
                })
              }
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="AVAILABLE">Available</option>
              <option value="COMING_SOON">Coming soon</option>
              <option value="WAITLIST">Waitlist only</option>
              <option value="SOLD_OUT">Sold out</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="maxSubscribers"
              className="block text-sm font-medium mb-2"
            >
              Max Active Subscribers (Optional)
            </label>
            <input
              type="number"
              id="maxSubscribers"
              value={formData.maxSubscribers}
              onChange={(e) =>
                setFormData({ ...formData, maxSubscribers: e.target.value })
              }
              placeholder="Unlimited"
              min="1"
              className="w-full px-3 py-2 border rounded-md"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank for unlimited. Counts only active subscriptions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : planId ? "Update Plan" : "Create Plan"}
        </Button>
      </div>
    </form>
  );
}
