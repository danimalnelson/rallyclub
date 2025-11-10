"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

export default function SuccessPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl">Welcome to the Club!</CardTitle>
          <CardDescription className="text-base">
            Your membership has been successfully activated.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-center">
              A confirmation email has been sent to you with all the details about your membership.
            </p>
          </div>

          <div className="space-y-2">
            <Link href={`/${params.slug}/portal`} className="block">
              <Button className="w-full" size="lg">
                Manage Your Membership
              </Button>
            </Link>
            <Link href={`/${params.slug}`} className="block">
              <Button variant="outline" className="w-full">
                Back to Home
              </Button>
            </Link>
          </div>

          {sessionId && (
            <p className="text-xs text-center text-muted-foreground">
              Session ID: {sessionId.slice(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

