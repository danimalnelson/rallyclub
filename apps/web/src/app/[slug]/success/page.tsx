import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import { CheckCircle } from "lucide-react";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id } = await searchParams;
  
  const business = await prisma.business.findUnique({
    where: { slug },
  });

  if (!business) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl">Welcome to {business.name}!</CardTitle>
          <CardDescription>
            Your subscription has been successfully created
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted">
              <h3 className="font-semibold mb-2">What happens next?</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>You'll receive a confirmation email with your subscription details</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Access your member portal to manage your subscription</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>Your first shipment will be prepared according to your plan schedule</span>
                </li>
              </ul>
            </div>

            {session_id && (
              <div className="text-xs text-muted-foreground text-center">
                Reference: {session_id.slice(0, 20)}...
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link href={`/${slug}/portal`}>
                Go to Member Portal
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${slug}`}>
                Back to {business.name}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
