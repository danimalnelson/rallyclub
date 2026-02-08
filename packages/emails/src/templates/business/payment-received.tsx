/**
 * Payment Received Notification Email
 * Sent to business owner when a successful payment is made
 */

export interface PaymentReceivedEmailProps {
  businessName: string;
  memberName: string;
  memberEmail: string;
  planName: string;
  amount: number;
  currency: string;
  paymentDate: string;
  dashboardUrl: string;
}

export function PaymentReceivedEmail(props: PaymentReceivedEmailProps): string {
  const { businessName, memberName, memberEmail, planName, amount, currency, paymentDate, dashboardUrl } = props;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Payment Received</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${businessName} team,</p>

    <p style="font-size: 16px; margin-bottom: 20px;">A payment has been successfully processed.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #667eea;">Payment Details</h3>
      <p style="margin: 10px 0;"><strong>Member:</strong> ${memberName}</p>
      <p style="margin: 10px 0;"><strong>Email:</strong> ${memberEmail}</p>
      <p style="margin: 10px 0;"><strong>Plan:</strong> ${planName}</p>
      <p style="margin: 10px 0;"><strong>Amount:</strong> $${(amount / 100).toFixed(2)} ${currency.toUpperCase()}</p>
      <p style="margin: 10px 0;"><strong>Date:</strong> ${paymentDate}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Transactions</a>
    </div>

    <p style="font-size: 12px; color: #999; margin-top: 30px;">
      This notification was sent by Vintigo Platform
    </p>
  </div>
</body>
</html>
  `;
}

export const paymentReceivedEmail = PaymentReceivedEmail;
