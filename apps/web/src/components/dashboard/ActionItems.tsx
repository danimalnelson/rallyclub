import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@wine-club/ui";
import {
  AlertCircle,
  CreditCard,
  Plus,
  Share2,
  CheckCircle2,
  DollarSign,
  ArrowRight,
} from "lucide-react";

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: "high" | "medium" | "low";
  icon: React.ReactNode;
}

interface ActionItemsProps {
  businessId: string;
  businessSlug: string | null;
  totalPlans: number;
  totalMembers: number;
  failedPayments: number;
  unresolvedAlerts: number;
  hasDynamicPricing: boolean;
  missingPriceCount: number;
}

export function ActionItems({
  businessId,
  businessSlug,
  totalPlans,
  totalMembers,
  failedPayments,
  unresolvedAlerts,
  hasDynamicPricing,
  missingPriceCount,
}: ActionItemsProps) {
  const actions = getContextualActions({
    businessId,
    businessSlug,
    totalPlans,
    totalMembers,
    failedPayments,
    unresolvedAlerts,
    hasDynamicPricing,
    missingPriceCount,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Action Items</CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="font-medium text-green-700 dark:text-green-400">
              All caught up!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              No urgent actions needed right now
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((action) => (
              <ActionItemRow key={action.id} action={action} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionItemRow({ action }: { action: ActionItem }) {
  const priorityColors = {
    high: "border-l-red-500 bg-red-50 dark:bg-red-950/50",
    medium: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/50",
    low: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/50",
  };

  return (
    <Link href={action.href} className="block">
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border-l-4 ${priorityColors[action.priority]} hover:opacity-80 transition-opacity`}
      >
        <div className="text-muted-foreground">{action.icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{action.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {action.description}
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function getContextualActions(params: {
  businessId: string;
  businessSlug: string | null;
  totalPlans: number;
  totalMembers: number;
  failedPayments: number;
  unresolvedAlerts: number;
  hasDynamicPricing: boolean;
  missingPriceCount: number;
}): ActionItem[] {
  const actions: ActionItem[] = [];

  // High priority: Failed payments
  if (params.failedPayments > 0) {
    actions.push({
      id: "failed-payments",
      title: `${params.failedPayments} failed payment${params.failedPayments > 1 ? "s" : ""}`,
      description: "Members need to update their payment method",
      href: `/app/${params.businessId}/members?status=past_due`,
      priority: "high",
      icon: <CreditCard className="h-4 w-4" />,
    });
  }

  // High priority: Missing dynamic prices
  if (params.hasDynamicPricing && params.missingPriceCount > 0) {
    actions.push({
      id: "missing-prices",
      title: `Set ${params.missingPriceCount} upcoming price${params.missingPriceCount > 1 ? "s" : ""}`,
      description: "Dynamic pricing plans need next month's price",
      href: `/app/${params.businessId}/alerts`,
      priority: "high",
      icon: <DollarSign className="h-4 w-4" />,
    });
  }

  // High priority: Other unresolved alerts
  const otherAlerts = params.unresolvedAlerts - params.missingPriceCount;
  if (otherAlerts > 0) {
    actions.push({
      id: "unresolved-alerts",
      title: `${otherAlerts} alert${otherAlerts > 1 ? "s" : ""} need attention`,
      description: "Review and resolve pending alerts",
      href: `/app/${params.businessId}/alerts`,
      priority: "high",
      icon: <AlertCircle className="h-4 w-4" />,
    });
  }

  // Medium priority: No plans yet
  if (params.totalPlans === 0) {
    actions.push({
      id: "create-plan",
      title: "Create your first plan",
      description: "Set up a membership plan to start accepting members",
      href: `/app/${params.businessId}/memberships/create`,
      priority: "medium",
      icon: <Plus className="h-4 w-4" />,
    });
  }

  // Medium priority: Plans but no members
  if (params.totalPlans > 0 && params.totalMembers === 0) {
    actions.push({
      id: "share-page",
      title: "Share your public page",
      description: "Invite your first members to join",
      href: `/app/${params.businessId}/settings`,
      priority: "medium",
      icon: <Share2 className="h-4 w-4" />,
    });
  }

  return actions;
}
