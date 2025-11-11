import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@wine-club/db";
import { Card, CardContent, formatCurrency, formatDate } from "@wine-club/ui";

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { businessId } = await params;
  const business = await prisma.business.findFirst({
    where: {
      id: businessId,
      users: {
        some: {
          userId: session.user.id,
        },
      },
    },
  });

  if (!business) {
    notFound();
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      businessId: business.id,
    },
    include: {
      consumer: true,
      subscription: {
        include: {
          membershipPlan: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{business.name} - Transactions</h1>
            <Link href={`/app/${business.id}`}>
              <button className="text-sm text-muted-foreground hover:text-foreground">
                ← Back
              </button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Transactions</h2>
          <p className="text-muted-foreground">
            View all charges, refunds, and fees
          </p>
        </div>

        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No transactions yet</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="p-4 font-medium text-sm text-muted-foreground">Date</th>
                      <th className="p-4 font-medium text-sm text-muted-foreground">Customer</th>
                      <th className="p-4 font-medium text-sm text-muted-foreground">Plan</th>
                      <th className="p-4 font-medium text-sm text-muted-foreground">Type</th>
                      <th className="p-4 font-medium text-sm text-muted-foreground text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {transactions.map((transaction: any) => (
                      <tr key={transaction.id} className="hover:bg-muted/50">
                        <td className="p-4 text-sm">
                          {formatDate(transaction.createdAt)}
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-medium">
                            {transaction.consumer.name || "No name"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.consumer.email}
                          </div>
                        </td>
                        <td className="p-4 text-sm">
                          {transaction.subscription?.membershipPlan.name || "—"}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              transaction.type === "CHARGE"
                                ? "bg-green-100 text-green-700"
                                : transaction.type === "REFUND"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {transaction.type}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-right font-medium">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

