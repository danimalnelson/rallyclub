import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";
import { XCircle } from "lucide-react";

export default async function CancelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
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
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
          <CardDescription>
            Your subscription was not created
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              No charges were made. You can try again anytime or browse our other membership options.
            </p>
          </div>

          <div className="space-y-2">
            <Button asChild className="w-full" size="lg">
              <Link href={`/${slug}`}>
                Browse Plans
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/${slug}/portal`}>
                Member Portal
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

