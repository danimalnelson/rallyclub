import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET(req: NextRequest) {
  // Guard: Only allow test endpoints in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const testEmail = req.nextUrl.searchParams.get("to") || "test@example.com";
  
  // Check if RESEND_API_KEY is set
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({
      success: false,
      error: "RESEND_API_KEY environment variable not set",
      env_check: {
        RESEND_API_KEY: "❌ NOT SET",
        EMAIL_FROM: process.env.EMAIL_FROM || "not set",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "not set",
      }
    }, { status: 500 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    console.log(`[TEST] Attempting to send test email to: ${testEmail}`);
    
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: testEmail,
      subject: "Test Email from Vintigo",
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>✅ Email System Working!</h2>
          <p>If you're reading this, Resend is configured correctly.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log(`[TEST] Email sent successfully:`, result);

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      email_id: result.data?.id,
      sent_to: testEmail,
      sent_from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      env_check: {
        RESEND_API_KEY: "✅ SET (length: " + process.env.RESEND_API_KEY.length + ")",
        EMAIL_FROM: process.env.EMAIL_FROM || "using default: onboarding@resend.dev",
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "not set",
      }
    });

  } catch (error: any) {
    console.error("[TEST] Error sending email:", error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      error_details: {
        name: error.name,
        statusCode: error.statusCode,
        message: error.message,
      },
      env_check: {
        RESEND_API_KEY: "✅ SET (but may be invalid)",
        EMAIL_FROM: process.env.EMAIL_FROM || "using default",
      }
    }, { status: 500 });
  }
}

