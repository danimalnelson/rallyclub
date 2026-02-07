import { Card, CardContent, CardHeader } from "@wine-club/ui";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function PlansLoading() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Skeleton className="h-7 w-44 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Membership group */}
      <div className="space-y-8">
        {[...Array(2)].map((_, g) => (
          <div key={g}>
            <div className="flex items-center justify-between mb-4">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-12" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <div className="pt-3 border-t flex justify-between">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
