import { Card, CardContent } from "@wine-club/ui";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function TransactionsLoading() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  {["Date", "Customer", "Plan", "Type", "Amount"].map((h) => (
                    <th key={h} className="p-4 text-left">
                      <Skeleton className="h-4 w-16" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="p-4">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-36" />
                    </td>
                    <td className="p-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="p-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
