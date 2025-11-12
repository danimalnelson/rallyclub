/**
 * Business Onboarding State Machine
 * Maps Stripe account state to internal BusinessStatus
 */

import type Stripe from "stripe";
import { BusinessStatus } from "@wine-club/db";

export interface StripeAccountState {
  id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
  payouts_enabled?: boolean;
  requirements?: {
    currently_due?: string[] | null;
    eventually_due?: string[] | null;
    past_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
  capabilities?: {
    card_payments?: { status: string };
    transfers?: { status: string };
  } | null;
}

export interface StateTransition {
  from: BusinessStatus;
  to: BusinessStatus;
  reason: string;
  timestamp: Date;
  eventId?: string;
}

/**
 * Determine the appropriate BusinessStatus based on Stripe account state
 */
export function determineBusinessState(
  currentStatus: BusinessStatus,
  stripeAccount: StripeAccountState | null
): BusinessStatus {
  // No Stripe account yet
  if (!stripeAccount) {
    if (currentStatus === "CREATED" || currentStatus === "DETAILS_COLLECTED") {
      return currentStatus;
    }
    return "STRIPE_ONBOARDING_REQUIRED";
  }

  // Check if onboarding is complete
  if (stripeAccount.charges_enabled && stripeAccount.details_submitted) {
    return "ONBOARDING_COMPLETE";
  }

  // Check if account is restricted
  const hasCurrentlyDue = (stripeAccount.requirements?.currently_due?.length ?? 0) > 0;
  const hasPastDue = (stripeAccount.requirements?.past_due?.length ?? 0) > 0;
  const disabledReason = stripeAccount.requirements?.disabled_reason;

  if (disabledReason || hasPastDue) {
    return "RESTRICTED";
  }

  // Check if details submitted but waiting for verification
  if (stripeAccount.details_submitted && !stripeAccount.charges_enabled) {
    return "PENDING_VERIFICATION";
  }

  // Has requirements but in progress
  if (hasCurrentlyDue || !stripeAccount.details_submitted) {
    return "STRIPE_ONBOARDING_IN_PROGRESS";
  }

  // Default: needs onboarding
  return "STRIPE_ONBOARDING_REQUIRED";
}

/**
 * Check if a state transition is valid
 */
export function isValidTransition(
  from: BusinessStatus,
  to: BusinessStatus
): boolean {
  // Define valid state transitions
  const validTransitions: Record<BusinessStatus, BusinessStatus[]> = {
    CREATED: ["DETAILS_COLLECTED", "ABANDONED"],
    DETAILS_COLLECTED: ["STRIPE_ACCOUNT_CREATED", "STRIPE_ONBOARDING_REQUIRED", "ABANDONED"],
    STRIPE_ACCOUNT_CREATED: ["STRIPE_ONBOARDING_REQUIRED", "STRIPE_ONBOARDING_IN_PROGRESS", "ABANDONED"],
    STRIPE_ONBOARDING_REQUIRED: ["STRIPE_ONBOARDING_IN_PROGRESS", "ABANDONED"],
    STRIPE_ONBOARDING_IN_PROGRESS: [
      "PENDING_VERIFICATION",
      "ONBOARDING_COMPLETE",
      "RESTRICTED",
      "FAILED",
      "ABANDONED",
    ],
    ONBOARDING_PENDING: [
      "STRIPE_ONBOARDING_IN_PROGRESS",
      "PENDING_VERIFICATION",
      "ONBOARDING_COMPLETE",
      "RESTRICTED",
      "ABANDONED",
    ],
    PENDING_VERIFICATION: ["ONBOARDING_COMPLETE", "RESTRICTED", "FAILED"],
    RESTRICTED: ["STRIPE_ONBOARDING_IN_PROGRESS", "ONBOARDING_COMPLETE", "SUSPENDED"],
    ONBOARDING_COMPLETE: ["RESTRICTED", "SUSPENDED"],
    FAILED: ["STRIPE_ONBOARDING_REQUIRED", "ABANDONED"],
    ABANDONED: ["STRIPE_ONBOARDING_REQUIRED"],
    SUSPENDED: ["ONBOARDING_COMPLETE"],
  };

  const allowedTransitions = validTransitions[from] || [];
  return allowedTransitions.includes(to);
}

/**
 * Get next action for user based on current state
 */
export function getNextAction(status: BusinessStatus, stripeAccount: StripeAccountState | null): {
  action: "complete_details" | "start_stripe_onboarding" | "resume_stripe_onboarding" | "wait_verification" | "fix_requirements" | "contact_support" | "none";
  message: string;
  canAccessDashboard: boolean;
} {
  switch (status) {
    case "CREATED":
      return {
        action: "complete_details",
        message: "Complete your business details to continue",
        canAccessDashboard: false,
      };

    case "DETAILS_COLLECTED":
    case "STRIPE_ONBOARDING_REQUIRED":
      return {
        action: "start_stripe_onboarding",
        message: "Connect your Stripe account to start accepting payments",
        canAccessDashboard: false,
      };

    case "STRIPE_ACCOUNT_CREATED":
    case "STRIPE_ONBOARDING_IN_PROGRESS":
    case "ONBOARDING_PENDING":
      return {
        action: "resume_stripe_onboarding",
        message: "Complete your Stripe onboarding to activate your account",
        canAccessDashboard: false,
      };

    case "PENDING_VERIFICATION":
      return {
        action: "wait_verification",
        message: "Your account is being verified by Stripe. This usually takes a few minutes to 24 hours.",
        canAccessDashboard: true, // Can view dashboard but not process payments
      };

    case "RESTRICTED":
      const requirements = stripeAccount?.requirements?.currently_due || [];
      return {
        action: "fix_requirements",
        message: `Your account requires additional information: ${requirements.join(", ")}`,
        canAccessDashboard: true,
      };

    case "ONBOARDING_COMPLETE":
      return {
        action: "none",
        message: "Your account is fully set up and ready to accept payments",
        canAccessDashboard: true,
      };

    case "FAILED":
      return {
        action: "contact_support",
        message: "There was an issue with your onboarding. Please contact support.",
        canAccessDashboard: false,
      };

    case "ABANDONED":
      return {
        action: "start_stripe_onboarding",
        message: "Resume your account setup to start accepting payments",
        canAccessDashboard: false,
      };

    case "SUSPENDED":
      return {
        action: "contact_support",
        message: "Your account has been suspended. Please contact support.",
        canAccessDashboard: false,
      };

    default:
      return {
        action: "none",
        message: "",
        canAccessDashboard: false,
      };
  }
}

/**
 * Create a state transition record
 */
export function createStateTransition(
  from: BusinessStatus,
  to: BusinessStatus,
  reason: string,
  eventId?: string
): StateTransition {
  return {
    from,
    to,
    reason,
    timestamp: new Date(),
    eventId,
  };
}

/**
 * Append a transition to the existing transitions array
 */
export function appendTransition(
  existingTransitions: StateTransition[] | null,
  newTransition: StateTransition
): StateTransition[] {
  const transitions = existingTransitions || [];
  return [...transitions, newTransition];
}

