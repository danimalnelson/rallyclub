"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, MenuContainer, Menu, MenuItem, MenuIconTrigger } from "@wine-club/ui";
import { Play, MoreVertical } from "geist-icons";
import { PauseCircle } from "@/components/icons/PauseCircle";
import { CrossCircle } from "geist-icons";
import { Cross } from "@/components/icons/Cross";

// ---------------------------------------------------------------------------
// Compact three-dot menu for row actions
// ---------------------------------------------------------------------------

function CompactMoreMenu({
  canPause,
  canCancel,
  loading,
  businessSlug,
  planId,
  onPause,
  onCancel,
}: {
  canPause: boolean;
  canCancel: boolean;
  loading: boolean;
  businessSlug?: string;
  planId?: string;
  onPause: () => void;
  onCancel: () => void;
}) {
  return (
    <MenuContainer>
      <MenuIconTrigger className="border-l border-transparent group-hover:border-gray-200 dark:group-hover:border-gray-600">
        <MoreVertical className="h-4 w-4" />
      </MenuIconTrigger>
      <Menu width={160} align="end">
        {canPause && (
          <MenuItem onClick={onPause} disabled={loading}>
            Pause subscription
          </MenuItem>
        )}
        {planId && businessSlug && (
          <MenuItem href={`/app/${businessSlug}/plans/${planId}/edit`}>
            Edit subscription
          </MenuItem>
        )}
        {canCancel && (
          <MenuItem onClick={onCancel} disabled={loading}>
            Cancel subscription
          </MenuItem>
        )}
        {planId && businessSlug && (
          <MenuItem href={`/app/${businessSlug}/plans/${planId}`}>
            View plan
          </MenuItem>
        )}
      </Menu>
    </MenuContainer>
  );
}

// ---------------------------------------------------------------------------
// Cancel Dialog (shared between compact and full modes)
// ---------------------------------------------------------------------------

function CancelDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [cancelReason, setCancelReason] = useState("");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Cancel Subscription"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Keep Subscription
          </Button>
          <Button
            variant="error"
            onClick={() => onConfirm(cancelReason)}
            disabled={loading}
          >
            {loading ? "Cancelling..." : "Cancel Subscription"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-800">
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
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-100"
            disabled={loading}
          />
        </div>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SubscriptionActionsProps {
  subscriptionId: string;
  stripeSubscriptionId: string;
  status: string;
  cancelAtPeriodEnd?: boolean | null;
  pausedAt: Date | null;
  /** Compact icon-only layout for row hover actions */
  compact?: boolean;
  businessSlug?: string;
  planId?: string;
}

export function SubscriptionActions({
  subscriptionId,
  stripeSubscriptionId,
  status,
  cancelAtPeriodEnd = false,
  pausedAt,
  compact = false,
  businessSlug,
  planId,
}: SubscriptionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const isPaused = pausedAt !== null;
  const coerceCancel = !!cancelAtPeriodEnd;
  const canPause = status === "active" && !coerceCancel && !isPaused;
  const canResume = isPaused;
  const canCancel = (status === "active" || status === "trialing") && !coerceCancel && !isPaused;

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

  const handleCancel = async (reason: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
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

  if (compact) {
    return (
      <>
        {/* Combined actions bar - hover actions + three-dot, one unit on row hover */}
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-stretch gap-0 overflow-hidden rounded-lg border border-transparent bg-transparent transition-[border-color,background-color,box-shadow] group-hover:border-gray-300 group-hover:bg-white group-hover:shadow-sm dark:group-hover:border-gray-600 dark:group-hover:bg-gray-100">
          <div className="pointer-events-none flex items-center opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [&>button:not(:first-child)]:border-l [&>button:not(:first-child)]:border-gray-200 dark:[&>button:not(:first-child)]:border-gray-600">
            {canPause && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handlePause(); }}
                disabled={loading}
                title="Pause"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-950 disabled:opacity-50 dark:text-gray-700 dark:hover:bg-gray-200 dark:hover:text-white"
              >
                <PauseCircle size={16} className="h-4 w-4" />
              </button>
            )}
            {canResume && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleResume(); }}
                disabled={loading}
                title="Resume"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-950 disabled:opacity-50 dark:text-gray-700 dark:hover:bg-gray-200 dark:hover:text-white"
              >
                <Play className="h-4 w-4" />
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowCancelDialog(true); }}
                disabled={loading}
                title="Cancel"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center text-gray-600 hover:bg-gray-100 hover:text-gray-950 disabled:opacity-50 dark:text-gray-700 dark:hover:bg-gray-200 dark:hover:text-white"
              >
                <CrossCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <CompactMoreMenu
            canPause={canPause}
            canCancel={canCancel}
            loading={loading}
            businessSlug={businessSlug}
            planId={planId}
            onPause={handlePause}
            onCancel={() => setShowCancelDialog(true)}
          />
        </div>
        <CancelDialog
          open={showCancelDialog}
          onClose={() => setShowCancelDialog(false)}
          onConfirm={handleCancel}
          loading={loading}
        />
      </>
    );
  }

  return (
    <div className="flex gap-2">
      {canPause && (
        <Button
          variant="secondary"
          size="small"
          onClick={handlePause}
          disabled={loading}
          prefix={<PauseCircle size={16} className="h-4 w-4" />}
        >
          {loading ? "Pausing..." : "Pause"}
        </Button>
      )}

      {canResume && (
        <Button
          variant="secondary"
          size="small"
          onClick={handleResume}
          disabled={loading}
          prefix={<Play className="h-4 w-4" />}
        >
          {loading ? "Resuming..." : "Resume"}
        </Button>
      )}

      {canCancel && (
        <Button
          variant="error"
          size="small"
          onClick={() => setShowCancelDialog(true)}
          disabled={loading}
          prefix={<Cross size={16} className="h-4 w-4" />}
        >
          Cancel
        </Button>
      )}

      <CancelDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleCancel}
        loading={loading}
      />
    </div>
  );
}
