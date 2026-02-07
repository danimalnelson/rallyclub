import { Card, CardContent } from "@wine-club/ui";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function MembersLoading() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Skeleton className="h-7 w-32 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div>
                      <Skeleton className="h-5 w-36 mb-1" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <div className="mt-3 flex items-center gap-4">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-9 w-24 ml-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
