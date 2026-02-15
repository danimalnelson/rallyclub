import {
  DashboardSkeleton,
  RevenueSkeleton,
} from "./_components/DashboardSkeleton";

/**
 * Next.js loading state for the dashboard page.
 * Mirrors the actual dashboard layout: metrics, activity/actions, revenue charts.
 * When Suspense boundaries inside page.tsx take over, this becomes a fallback
 * only for the initial route transition.
 */
export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto">
      <DashboardSkeleton />
      <RevenueSkeleton />
    </div>
  );
}
