import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET(req: NextRequest) {
  // Guard: Only allow test endpoints in non-production environments
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const testEmail = req.nextUrl.searchParams.get("email") || "test@example.com";
  
  console.log("[TEST] Email send diagnostic called");
  console.log("[TEST] Target email:", testEmail);
  console.log("[TEST] Resend configured:", !!resend);
  console.log("[TEST] API Key:", process.env.RESEND_API_KEY?.substring(0, 10) + "...");
  console.log("[TEST] EMAIL_FROM:", process.env.EMAIL_FROM);
  
  if (!resend) {
    return NextResponse.json({ 
      error: "Resend not configured",
      details: "RESEND_API_KEY is missing"
    }, { status: 500 });
  }

  try {
    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
      to: testEmail,
      subject: "Test Email from Vintigo",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test Email</h2>
          <p>This is a test email to verify Resend integration.</p>
          <p>If you received this, email sending is working correctly!</p>
          <p style="color: #999; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    console.log("[TEST] Email send result:", JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: !result.error,
      emailId: result.data?.id,
      from: process.env.EMAIL_FROM,
      to: testEmail,
      error: result.error || null,
      result: result,
    });
  } catch (error: any) {
    console.error("[TEST] Email send failed:", error);
    
    return NextResponse.json({
      error: "Email send failed",
      message: error?.message,
      statusCode: error?.statusCode,
      name: error?.name,
      details: error,
    }, { status: 500 });
  }
}

