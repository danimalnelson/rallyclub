/**
 * Cancellation Scheduled Email
 * Sent when a member requests cancellation (cancel at period end)
 */

export interface CancellationScheduledEmailProps {
  customerName: string;
  planName: string;
  accessUntilDate: string;
  businessName: string;
}

export function CancellationScheduledEmail(props: CancellationScheduledEmailProps): string {
  const { customerName, planName, accessUntilDate, businessName } = props;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cancellation Confirmed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #6b7280; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Cancellation Confirmed</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${customerName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">We've received your request to cancel <strong>${planName}</strong>.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
      <h3 style="margin-top: 0; color: #3b82f6;">What Happens Next</h3>
      <p style="margin: 10px 0;">You'll continue to have full access until <strong>${accessUntilDate}</strong>.</p>
      <p style="margin: 10px 0;">After that date, your subscription will end and you won't be charged again.</p>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Changed your mind? You can reactivate your subscription anytime before ${accessUntilDate} from the member portal.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Best wishes,<br>
      The ${businessName} Team
    </p>
  </div>
</body>
</html>
  `;
}

export const cancellationScheduledEmail = CancellationScheduledEmail;
