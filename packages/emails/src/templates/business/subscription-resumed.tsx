/**
 * Subscription Resumed Notification Email
 * Sent to business owner when a member resumes their subscription
 */

export interface SubscriptionResumedAlertEmailProps {
  businessName: string;
  memberName: string;
  memberEmail: string;
  planName: string;
  dashboardUrl: string;
}

export function SubscriptionResumedAlertEmail(props: SubscriptionResumedAlertEmailProps): string {
  const { businessName, memberName, memberEmail, planName, dashboardUrl } = props;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Resumed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Subscription Resumed</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Great news for ${businessName}!</p>

    <p style="font-size: 16px; margin-bottom: 20px;">A member has resumed their subscription.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">Resume Details</h3>
      <p style="margin: 10px 0;"><strong>Member:</strong> ${memberName}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> ${memberEmail}</p>
      <p style="margin: 10px 0;"><strong>Plan:</strong> ${planName}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">View in Dashboard</a>
    </div>

    <p style="font-size: 12px; color: #999; margin-top: 30px;">
      This notification was sent by Vintigo Platform
    </p>
  </div>
</body>
</html>
  `;
}

export const subscriptionResumedAlertEmail = SubscriptionResumedAlertEmail;
