import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import { UserPlus, UserMinus, CreditCard, Warning } from "geist-icons";
import { DataView } from "@/components/ui/data-view";

export type ActivityType = "new_member" | "cancellation" | "payment" | "failed_payment";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  metadata?: {
    amount?: number;
    currency?: string;
    planName?: string;
    consumerId?: string;
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  businessId: string;
  businessSlug?: string;
  maxItems?: number;
  showViewAll?: boolean;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  new_member: <UserPlus className="h-4 w-4 text-green-600" />,
  cancellation: <UserMinus className="h-4 w-4 text-gray-500" />,
  payment: <CreditCard className="h-4 w-4 text-blue-600" />,
  failed_payment: <Warning className="h-4 w-4 text-red-600" />,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  new_member: "bg-green-50 dark:bg-green-950",
  cancellation: "bg-gray-50 dark:bg-gray-900",
  payment: "bg-blue-50 dark:bg-blue-950",
  failed_payment: "bg-red-50 dark:bg-red-950",
};

export function ActivityFeed({
  activities,
  businessId,
  businessSlug,
  maxItems = 8,
  showViewAll = true,
}: ActivityFeedProps) {
  const slugOrId = businessSlug || businessId;
  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          {showViewAll && activities.length > 0 && (
            <Link
              href={`/app/${slugOrId}/members`}
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <DataView
          items={displayActivities}
          renderItem={(activity) => (
            <ActivityRow activity={activity} businessSlug={slugOrId} />
          )}
          keyExtractor={(a) => a.id}
          variant="spaced"
          emptyMessage="No recent activity"
          emptyDescription="Activity will appear here when members join or make payments"
        />
      </CardContent>
    </Card>
  );
}

function ActivityRow({
  activity,
  businessSlug,
}: {
  activity: ActivityItem;
  businessSlug: string;
}) {
  const timeAgo = getRelativeTime(activity.timestamp);

  const content = (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg ${ACTIVITY_COLORS[activity.type]}`}
    >
      <div className="mt-0.5">{ACTIVITY_ICONS[activity.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{activity.title}</p>
        <p className="text-xs text-muted-foreground truncate">
          {activity.description}
        </p>
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {timeAgo}
      </div>
    </div>
  );

  if (activity.metadata?.consumerId) {
    return (
      <Link
        href={`/app/${businessSlug}/members/${activity.metadata.consumerId}`}
        className="block hover:opacity-80 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Helper to create activity items from database records
 */
export function createActivityFromSubscription(
  subscription: {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    consumer: { id: string; name: string | null; email: string };
    plan: { name: string; basePrice: number | null; currency: string };
  },
  type: "new" | "cancelled"
): ActivityItem {
  const consumerName = subscription.consumer.name || subscription.consumer.email.split("@")[0];

  if (type === "new") {
    return {
      id: `sub-new-${subscription.id}`,
      type: "new_member",
      title: `${consumerName} joined`,
      description: subscription.plan.name,
      timestamp: subscription.createdAt,
      metadata: {
        planName: subscription.plan.name,
        consumerId: subscription.consumer.id,
      },
    };
  }

  return {
    id: `sub-cancel-${subscription.id}`,
    type: "cancellation",
    title: `${consumerName} cancelled`,
    description: subscription.plan.name,
    timestamp: subscription.updatedAt,
    metadata: {
      planName: subscription.plan.name,
      consumerId: subscription.consumer.id,
    },
  };
}

export function createActivityFromTransaction(
  transaction: {
    id: string;
    amount: number;
    currency: string;
    type: string;
    createdAt: Date;
    consumer: { id: string; name: string | null; email: string };
  }
): ActivityItem {
  const consumerName = transaction.consumer.name || transaction.consumer.email.split("@")[0];
  const amount = formatCurrency(transaction.amount, transaction.currency);

  return {
    id: `tx-${transaction.id}`,
    type: "payment",
    title: `Payment received`,
    description: `${amount} from ${consumerName}`,
    timestamp: transaction.createdAt,
    metadata: {
      amount: transaction.amount,
      currency: transaction.currency,
      consumerId: transaction.consumer.id,
    },
  };
}
