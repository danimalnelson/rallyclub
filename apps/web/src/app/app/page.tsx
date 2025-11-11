import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wine-club/ui";

export default async function AppHomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const businesses = await prisma.business.findMany({
    where: {
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
    include: {
      users: {
        where: {
          userId: session.user.id,
        },
        select: {
          role: true,
        },
      },
      _count: {
        select: {
          members: true,
          membershipPlans: true,
        },
      },
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Wine Club Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            {session.user.email}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">My Businesses</h2>
          <p className="text-muted-foreground">
            Select a business to manage or create a new one
          </p>
        </div>

        {businesses.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Businesses Yet</CardTitle>
              <CardDescription>
                Get started by creating your first business
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/app/create">
                <Button>Create Business</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {businesses.map((business: any) => (
              <Link key={business.id} href={`/app/${business.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      {business.logoUrl && (
                        <img
                          src={business.logoUrl}
                          alt={business.name}
                          className="h-10 w-10 rounded"
                        />
                      )}
                      <div>
                        <CardTitle>{business.name}</CardTitle>
                        <CardDescription>@{business.slug}</CardDescription>
                      </div>
                    </div>
                    <div className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-primary/10 text-primary">
                      {business.users[0]?.role}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Members</span>
                        <span className="font-medium">{business._count.members}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plans</span>
                        <span className="font-medium">{business._count.membershipPlans}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`font-medium ${business.stripeAccountId ? 'text-green-600' : 'text-yellow-600'}`}>
                          {business.stripeAccountId ? 'Connected' : 'Setup Required'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            
            <Link href="/app/create">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-dashed flex items-center justify-center min-h-[200px]">
                <CardContent className="text-center">
                  <div className="text-4xl mb-2">+</div>
                  <p className="font-medium">Create New Business</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

