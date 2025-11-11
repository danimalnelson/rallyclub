/**
 * Email service using Resend
 * Handles transactional emails for the platform
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY not set, skipping email send");
    return false;
  }

  // Use EMAIL_FROM env var or default to Resend's test sender
  const fromEmail = options.from || process.env.EMAIL_FROM || "onboarding@resend.dev";

  try {
    console.log(`[EMAIL] Sending email to: ${options.to}, from: ${fromEmail}, subject: ${options.subject}`);
    
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }
      console.error("[EMAIL] Failed to send:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });
      return false;
    }

    const data = await response.json();
    console.log("[EMAIL] Sent successfully. ID:", data.id);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending email:", error);
    return false;
  }
}

/**
 * Email Templates
 */

export function subscriptionConfirmationEmail(params: {
  customerName: string;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  businessName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Confirmed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Welcome to ${params.businessName}!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${params.customerName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">Your subscription to <strong>${params.planName}</strong> has been confirmed!</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h3 style="margin-top: 0; color: #667eea;">Subscription Details</h3>
      <p style="margin: 10px 0;"><strong>Plan:</strong> ${params.planName}</p>
      <p style="margin: 10px 0;"><strong>Amount:</strong> $${(params.amount / 100).toFixed(2)} ${params.currency.toUpperCase()} / ${params.interval}</p>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      You can manage your subscription, update your payment method, or cancel anytime from your member portal.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Questions? Reply to this email and we'll be happy to help!
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Cheers,<br>
      The ${params.businessName} Team
    </p>
  </div>
</body>
</html>
  `;
}

export function paymentFailedEmail(params: {
  customerName: string;
  planName: string;
  amount: number;
  currency: string;
  businessName: string;
  portalUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Failed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f97316; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Payment Update Required</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${params.customerName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">We had trouble processing your payment for <strong>${params.planName}</strong> ($${(params.amount / 100).toFixed(2)} ${params.currency.toUpperCase()}).</p>
    
    <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f97316;">
      <h3 style="margin-top: 0; color: #f97316;">Action Required</h3>
      <p style="margin: 10px 0;">Please update your payment method to avoid service interruption.</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.portalUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">Update Payment Method</a>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If you have questions or need help, please don't hesitate to reach out.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      Best regards,<br>
      The ${params.businessName} Team
    </p>
  </div>
</body>
</html>
  `;
}

export function refundProcessedEmail(params: {
  customerName: string;
  amount: number;
  currency: string;
  businessName: string;
  reason?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Refund Processed</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #10b981; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Refund Processed</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${params.customerName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">A refund of <strong>$${(params.amount / 100).toFixed(2)} ${params.currency.toUpperCase()}</strong> has been processed to your original payment method.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">Refund Details</h3>
      <p style="margin: 10px 0;"><strong>Amount:</strong> $${(params.amount / 100).toFixed(2)} ${params.currency.toUpperCase()}</p>
      ${params.reason ? `<p style="margin: 10px 0;"><strong>Reason:</strong> ${params.reason}</p>` : ''}
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      The refund will appear in your account within 5-10 business days, depending on your bank.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      If you have any questions, please don't hesitate to contact us.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Best regards,<br>
      The ${params.businessName} Team
    </p>
  </div>
</body>
</html>
  `;
}

export function subscriptionCancelledEmail(params: {
  customerName: string;
  planName: string;
  cancellationDate: string;
  businessName: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subscription Cancelled</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #6b7280; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Subscription Cancelled</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hi ${params.customerName},</p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">Your subscription to <strong>${params.planName}</strong> has been cancelled.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6b7280;">
      <h3 style="margin-top: 0; color: #6b7280;">What This Means</h3>
      <p style="margin: 10px 0;">You'll continue to have access until <strong>${params.cancellationDate}</strong>.</p>
      <p style="margin: 10px 0;">After that date, your subscription benefits will end and you won't be charged again.</p>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      We're sorry to see you go! If there's anything we could have done better, we'd love to hear from you.
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 20px;">
      You can rejoin anytime - we'll be here when you're ready!
    </p>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      Best wishes,<br>
      The ${params.businessName} Team
    </p>
  </div>
</body>
</html>
  `;
}

