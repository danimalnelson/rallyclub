"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MembershipFormProps {
  businessId: string;
  membership?: {
    id: string;
    name: string;
    description: string | null;
    slug: string;
    billingInterval: string;
    billingAnchor: string;
    cohortBillingDay: number | null;
    chargeImmediately: boolean;
    allowMultiplePlans: boolean;
    maxMembers: number | null;
    status: string;
    giftEnabled: boolean;
    waitlistEnabled: boolean;
    membersOnlyAccess: boolean;
    pauseEnabled: boolean;
    skipEnabled: boolean;
    benefits: any;
    displayOrder: number;
  };
}

export const MembershipForm = React.memo(
  ({ businessId, membership }: MembershipFormProps) => {
    const router = useRouter();
    const isEdit = !!membership;

    // Form state
    const [name, setName] = useState(membership?.name || "");
    const [description, setDescription] = useState(
      membership?.description || ""
    );
    const [slug, setSlug] = useState(membership?.slug || "");
    const [billingInterval, setBillingInterval] = useState(
      membership?.billingInterval || "MONTH"
    );
    const [billingAnchor, setBillingAnchor] = useState(
      membership?.billingAnchor || "IMMEDIATE"
    );
    const [cohortBillingDay] = useState("1");  // Hardcoded to 1 for MVP
    const [chargeImmediately, setChargeImmediately] = useState(
      membership?.chargeImmediately ?? true
    );
    const [allowMultiplePlans, setAllowMultiplePlans] = useState(
      membership?.allowMultiplePlans || false
    );
    const [maxMembers, setMaxMembers] = useState(
      membership?.maxMembers?.toString() || ""
    );
    const [status, setStatus] = useState(membership?.status || "DRAFT");
    const [giftEnabled, setGiftEnabled] = useState(
      membership?.giftEnabled ?? true
    );
    const [waitlistEnabled, setWaitlistEnabled] = useState(
      membership?.waitlistEnabled ?? false
    );
    const [membersOnlyAccess, setMembersOnlyAccess] = useState(
      membership?.membersOnlyAccess ?? false
    );
    const [pauseEnabled, setPauseEnabled] = useState(
      membership?.pauseEnabled ?? false
    );
    const [skipEnabled, setSkipEnabled] = useState(
      membership?.skipEnabled ?? false
    );
    const [benefits, setBenefits] = useState<string[]>(
      membership?.benefits || []
    );
    const [newBenefit, setNewBenefit] = useState("");
    const [displayOrder, setDisplayOrder] = useState(
      membership?.displayOrder?.toString() || "0"
    );

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Fetch subscription count for edit mode
    const { data: subscriptionData, error: swrError } = useSWR(
      isEdit && membership?.id
        ? `/api/memberships/${membership.id}/subscription-count`
        : null,
      fetcher
    );

    // Debug logging
    React.useEffect(() => {
      if (isEdit) {
        console.log("[MembershipForm] Edit mode:", {
          membershipId: membership?.id,
          subscriptionData,
          swrError,
        });
      }
    }, [isEdit, membership?.id, subscriptionData, swrError]);

    const activeSubscriptionCount = subscriptionData?.count || 0;
    const hasBillingRestriction = isEdit && activeSubscriptionCount > 0;

    // More debug logging
    console.log("[MembershipForm] Restriction check:", {
      isEdit,
      activeSubscriptionCount,
      hasBillingRestriction,
      subscriptionData,
    });

    // Auto-generate slug from name
    const handleNameChange = useCallback(
      (value: string) => {
        setName(value);
        if (!isEdit) {
          const generatedSlug = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          setSlug(generatedSlug);
        }
      },
      [isEdit]
    );

    // Add benefit
    const handleAddBenefit = useCallback(() => {
      if (newBenefit.trim()) {
        setBenefits((prev) => [...prev, newBenefit.trim()]);
        setNewBenefit("");
      }
    }, [newBenefit]);

    // Remove benefit
    const handleRemoveBenefit = useCallback((index: number) => {
      setBenefits((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // Submit form
    const handleSubmit = useCallback(
      async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsSubmitting(true);

        try {
          const payload = {
            name,
            description: description || null,
            slug,
            billingInterval,
            billingAnchor,
            cohortBillingDay:
              billingAnchor === "NEXT_INTERVAL" ? 1 : null,  // Hardcoded to 1
            chargeImmediately: billingAnchor === "NEXT_INTERVAL" ? chargeImmediately : true,
            allowMultiplePlans,
            maxMembers: maxMembers ? parseInt(maxMembers, 10) : null,
            status,
            giftEnabled,
            waitlistEnabled,
            membersOnlyAccess,
            pauseEnabled,
            skipEnabled,
            benefits: benefits.length > 0 ? benefits : null,
            displayOrder: parseInt(displayOrder, 10) || 0,
          };

          const url = isEdit
            ? `/api/memberships/${membership.id}`
            : "/api/memberships/create";

          const response = await fetch(url, {
            method: isEdit ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ businessId, ...payload }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Failed to save membership");
          }

          // Success - redirect to memberships list
          router.push(`/app/${businessId}/memberships`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "An error occurred");
          setIsSubmitting(false);
        }
      },
      [
        name,
        description,
        slug,
        billingInterval,
        billingAnchor,
        chargeImmediately,
        allowMultiplePlans,
        maxMembers,
        status,
        giftEnabled,
        waitlistEnabled,
        membersOnlyAccess,
        pauseEnabled,
        skipEnabled,
        benefits,
        displayOrder,
        businessId,
        isEdit,
        membership,
        router,
      ]
    );

    return (
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {isEdit ? "Edit Membership" : "Create Membership"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit
              ? "Update your membership details and settings"
              : "Create a new membership to organize your subscription plans"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Name and describe your membership
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="e.g., Wine Club, Premium Membership"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Slug <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                  disabled={isEdit}
                  className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                  placeholder="wine-club"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  {isEdit
                    ? "Slug cannot be changed after creation"
                    : "Auto-generated from name, or customize"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Describe what this membership includes..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Display Order
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="0"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Lower numbers appear first
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Billing Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Configuration</CardTitle>
              <CardDescription>
                Configure how and when members start and are billed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Debug info - remove after testing */}
              {isEdit && (
                <div className="border border-blue-300 bg-blue-50 text-blue-900 rounded-lg p-3 text-xs mb-4">
                  <strong>Debug:</strong> isEdit={String(isEdit)}, count={activeSubscriptionCount}, 
                  hasBillingRestriction={String(hasBillingRestriction)}, 
                  data={JSON.stringify(subscriptionData)}
                </div>
              )}

              {/* Warning: Active subscriptions exist */}
              {hasBillingRestriction && (
                <div className="border border-amber-300 bg-amber-50 text-amber-900 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm mb-1">
                        Billing Settings Locked
                      </h4>
                      <p className="text-sm">
                        You have{" "}
                        <span className="font-semibold">
                          {activeSubscriptionCount} active subscription
                          {activeSubscriptionCount !== 1 ? "s" : ""}
                        </span>
                        . Billing settings cannot be changed while subscriptions
                        are active. Cancel or wait for subscriptions to expire
                        before modifying billing settings.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Frequency */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Billing Frequency <span className="text-red-500">*</span>
                </label>
                <select
                  value={billingInterval}
                  onChange={(e) => setBillingInterval(e.target.value)}
                  disabled={hasBillingRestriction}
                  className={`w-full px-3 py-2 border rounded-md ${
                    hasBillingRestriction
                      ? "bg-gray-100 cursor-not-allowed opacity-60"
                      : ""
                  }`}
                >
                  <option value="MONTH">Monthly</option>
                  {/* Future: <option value="QUARTER">Quarterly (every 3 months)</option> */}
                  {/* Future: <option value="YEAR">Annually</option> */}
                </select>
                <p className="text-sm text-muted-foreground mt-1">
                  All plans in this membership will bill at this frequency
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-3">
                  How should members start and be billed? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-4">
                  {/* Option 1: Rolling Membership */}
                  <label
                    className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
                      hasBillingRestriction
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingModel"
                      checked={billingAnchor === "IMMEDIATE"}
                      onChange={() => {
                        setBillingAnchor("IMMEDIATE");
                        setChargeImmediately(true);
                      }}
                      disabled={hasBillingRestriction}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1">
                      <div className="font-semibold mb-1">Rolling Membership</div>
                      <div className="text-sm text-muted-foreground">
                        Members start and are charged immediately. Each member is billed monthly on their signup date.
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 italic">
                        Example: April 15 signup → Charged $20 → Billed every 15th
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Cohort (Immediate Access) */}
                  <label
                    className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
                      hasBillingRestriction
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingModel"
                      checked={billingAnchor === "NEXT_INTERVAL" && chargeImmediately}
                      onChange={() => {
                        setBillingAnchor("NEXT_INTERVAL");
                        setChargeImmediately(true);
                      }}
                      disabled={hasBillingRestriction}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1">
                      <div className="font-semibold mb-1">Cohort Membership (Immediate Access)</div>
                      <div className="text-sm text-muted-foreground">
                        Members start and are charged immediately. All members are then billed together on the 1st of each month.
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 italic">
                        Example: April 15 signup → Charged $20 → Next bill May 1
                      </div>
                    </div>
                  </label>

                  {/* Option 3: Cohort (Deferred Start) */}
                  <label
                    className={`flex items-start space-x-3 p-4 border rounded-lg transition-colors ${
                      hasBillingRestriction
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer hover:bg-accent/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="billingModel"
                      checked={billingAnchor === "NEXT_INTERVAL" && !chargeImmediately}
                      onChange={() => {
                        setBillingAnchor("NEXT_INTERVAL");
                        setChargeImmediately(false);
                      }}
                      disabled={hasBillingRestriction}
                      className="mt-1 shrink-0"
                    />
                    <div className="flex-1">
                      <div className="font-semibold mb-1">Cohort Membership (Deferred Start)</div>
                      <div className="text-sm text-muted-foreground">
                        Members wait until the next billing date. Payment and access both begin on the 1st of the month.
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 italic">
                        Example: April 15 signup → Starts May 1 → Charged $20
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Membership Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Membership Rules</CardTitle>
              <CardDescription>
                Configure capacity and plan restrictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowMultiplePlans}
                    onChange={(e) => setAllowMultiplePlans(e.target.checked)}
                  />
                  <div>
                    <div className="font-medium">Allow Multiple Plans</div>
                    <div className="text-sm text-muted-foreground">
                      Members can subscribe to multiple plans within this
                      membership
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Maximum Members
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Optional capacity limit for this membership
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waitlistEnabled}
                    onChange={(e) => setWaitlistEnabled(e.target.checked)}
                  />
                  <div>
                    <div className="font-medium">Enable Waitlist</div>
                    <div className="text-sm text-muted-foreground">
                      Allow members to join a waitlist when capacity is reached
                    </div>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Member Features */}
          <Card>
            <CardHeader>
              <CardTitle>Member Features</CardTitle>
              <CardDescription>
                Enable or disable features for members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={giftEnabled}
                    onChange={(e) => setGiftEnabled(e.target.checked)}
                  />
                  <div>
                    <div className="font-medium">Gift Subscriptions</div>
                    <div className="text-sm text-muted-foreground">
                      Allow this membership to be purchased as a gift
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pauseEnabled}
                    onChange={(e) => setPauseEnabled(e.target.checked)}
                  />
                  <div>
                    <div className="font-medium">Allow Pause</div>
                    <div className="text-sm text-muted-foreground">
                      Members can pause their subscription (stops billing)
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipEnabled}
                    onChange={(e) => setSkipEnabled(e.target.checked)}
                  />
                  <div>
                    <div className="font-medium">Allow Skip</div>
                    <div className="text-sm text-muted-foreground">
                      Members can skip individual deliveries
                    </div>
                  </div>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={membersOnlyAccess}
                    onChange={(e) => setMembersOnlyAccess(e.target.checked)}
                  />
                  <div>
                    <div className="font-medium">Members-Only Access</div>
                    <div className="text-sm text-muted-foreground">
                      Hide this membership from non-members
                    </div>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          <Card>
            <CardHeader>
              <CardTitle>Member Benefits</CardTitle>
              <CardDescription>
                List the benefits included with this membership
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBenefit}
                  onChange={(e) => setNewBenefit(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddBenefit();
                    }
                  }}
                  className="flex-1 px-3 py-2 border rounded-md"
                  placeholder="e.g., 10% off store purchases"
                />
                <Button
                  type="button"
                  onClick={handleAddBenefit}
                  variant="outline"
                >
                  Add
                </Button>
              </div>

              {benefits.length > 0 && (
                <ul className="space-y-2">
                  {benefits.map((benefit, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-md"
                    >
                      <span>{benefit}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBenefit(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/app/${businessId}/memberships`)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEdit
                ? "Update Membership"
                : "Create Membership"}
            </Button>
          </div>
        </div>
      </form>
    );
  }
);

MembershipForm.displayName = "MembershipForm";

