import { Card, CardContent } from "@wine-club/ui";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function TransactionsLoading() {
  return (
    <>
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-10 -mx-3 px-3 pt-3 flex items-center gap-2 pb-3 mb-3 border-b border-gray-400 bg-ds-background-200">
        <Skeleton className="h-4 w-[120px] shrink-0" />
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <div className="flex-1" />
        <Skeleton className="h-9 w-20 rounded-md" />
      </div>

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b">
              <tr>
                {["Date", "Customer", "Email", "Plan", "Type", "Payment method", "Amount"].map((h) => (
                  <th key={h} className="px-3 h-[42px] text-left">
                    <Skeleton className="h-3 w-14" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[...Array(10)].map((_, i) => (
                <tr key={i} className="h-[42px]">
                  <td className="px-3"><Skeleton className="h-3.5 w-28" /></td>
                  <td className="px-3"><Skeleton className="h-3.5 w-24" /></td>
                  <td className="px-3"><Skeleton className="h-3.5 w-36" /></td>
                  <td className="px-3"><Skeleton className="h-3.5 w-16" /></td>
                  <td className="px-3"><Skeleton className="h-5 w-16 rounded" /></td>
                  <td className="px-3"><Skeleton className="h-3.5 w-24" /></td>
                  <td className="px-3 text-right"><Skeleton className="h-3.5 w-14 ml-auto" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Footer skeleton */}
      <div className="sticky bottom-0 -mx-3 px-3 mt-3 flex items-center h-10 border-t border-gray-400 bg-ds-background-200">
        <Skeleton className="h-3 w-16" />
      </div>
    </>
  );
}
