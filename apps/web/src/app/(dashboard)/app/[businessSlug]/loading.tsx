import { Card, CardContent, CardHeader } from "@wine-club/ui";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Chart placeholder */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
