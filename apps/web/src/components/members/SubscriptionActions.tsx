"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@wine-club/ui";
import { Pause, Play, X as XIcon } from "lucide-react";

interface SubscriptionActionsProps {
  subscriptionId: string;
  stripeSubscriptionId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  pausedAt: Date | null;
}

export function SubscriptionActions({
  subscriptionId,
  stripeSubscriptionId,
  status,
  cancelAtPeriodEnd,
  pausedAt,
}: SubscriptionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const isPaused = pausedAt !== null;
  const canPause = status === "active" && !cancelAtPeriodEnd && !isPaused;
  const canResume = isPaused;
  const canCancel = (status === "active" || status === "trialing") && !cancelAtPeriodEnd && !isPaused;

  const handlePause = async () => {
    if (!confirm("Pause this subscription? The member won't be charged until resumed.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/pause`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Pause error:", error);
        throw new Error(error.details || "Failed to pause subscription");
      }

      alert("✅ Subscription paused successfully!");
      router.refresh();
    } catch (error: any) {
      console.error("Pause error:", error);
      alert(`Failed to pause subscription: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!confirm("Resume this subscription? The member will be charged on the next billing date.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/resume`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to resume subscription");
      }

      router.refresh();
    } catch (error) {
      alert("Failed to resume subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!response.ok) {
        throw new Error("Failed to cancel subscription");
      }

      setShowCancelDialog(false);
      router.refresh();
    } catch (error) {
      alert("Failed to cancel subscription. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      {canPause && (
        <Button
          variant="outline"
          size="sm"
          onClick={handlePause}
          disabled={loading}
          className="gap-2"
        >
          <Pause className="h-4 w-4" />
          {loading ? "Pausing..." : "Pause"}
        </Button>
      )}

      {canResume && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
          disabled={loading}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          {loading ? "Resuming..." : "Resume"}
        </Button>
      )}

      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCancelDialog(true)}
          disabled={loading}
          className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950"
        >
          <XIcon className="h-4 w-4" />
          Cancel
        </Button>
      )}

      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Cancel Subscription</h2>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will cancel the subscription at the end of the current billing period.
                The member will retain access until then.
              </p>

              <div>
                <label htmlFor="cancelReason" className="block text-sm font-medium mb-2">
                  Reason for Cancellation (Optional)
                </label>
                <textarea
                  id="cancelReason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g., Customer requested, payment issues, etc."
                  rows={3}
                  className="w-full px-3 py-2 border rounded-md"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(false)}
                  disabled={loading}
                >
                  Keep Subscription
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Cancelling..." : "Cancel Subscription"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

