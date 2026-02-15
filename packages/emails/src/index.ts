/**
 * @wine-club/emails
 * 
 * Centralized email system for the wine club platform.
 * Provides email sending functionality and templates for both
 * members and business owners.
 */

// Core email sending functions
export { sendEmail, sendBusinessEmail } from "./send";
export type { EmailOptions, EmailResult } from "./send";

// Member email templates
export {
  WelcomeEmail,
  subscriptionConfirmationEmail,
  PaymentFailedEmail,
  paymentFailedEmail,
  SubscriptionCancelledEmail,
  subscriptionCancelledEmail,
  CancellationScheduledEmail,
  cancellationScheduledEmail,
  SubscriptionPausedEmail,
  subscriptionPausedEmail,
  SubscriptionResumedEmail,
  subscriptionResumedEmail,
  RenewalReminderEmail,
  renewalReminderEmail,
  RefundProcessedEmail,
  refundProcessedEmail,
} from "./templates/member";

export type {
  WelcomeEmailProps,
  PaymentFailedEmailProps,
  SubscriptionCancelledEmailProps,
  CancellationScheduledEmailProps,
  SubscriptionPausedEmailProps,
  SubscriptionResumedEmailProps,
  RenewalReminderEmailProps,
  RefundProcessedEmailProps,
} from "./templates/member";

// Business owner email templates
export {
  NewMemberEmail,
  newMemberEmail,
  MemberChurnedEmail,
  memberChurnedEmail,
  CancellationScheduledAlertEmail,
  cancellationScheduledAlertEmail,
  MonthlySummaryEmail,
  monthlySummaryEmail,
  PaymentAlertEmail,
  paymentAlertEmail,
  SubscriptionPausedAlertEmail,
  subscriptionPausedAlertEmail,
  SubscriptionResumedAlertEmail,
  subscriptionResumedAlertEmail,
  PaymentReceivedEmail,
  paymentReceivedEmail,
} from "./templates/business";

export type {
  NewMemberEmailProps,
  MemberChurnedEmailProps,
  CancellationScheduledAlertEmailProps,
  MonthlySummaryEmailProps,
  PaymentAlertEmailProps,
  SubscriptionPausedAlertEmailProps,
  SubscriptionResumedAlertEmailProps,
  PaymentReceivedEmailProps,
} from "./templates/business";
