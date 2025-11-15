import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            A sign in link has been sent to your email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <div className="text-6xl mb-4">📧</div>
            <p className="text-sm text-muted-foreground mb-4">
              We&apos;ve sent you an email with a magic link to sign in.
            </p>
            <p className="text-sm text-muted-foreground">
              Click the link in the email to continue.
            </p>
          </div>
          
          <div className="text-center pt-4 border-t">
            <Link 
              href="/auth/signin" 
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

