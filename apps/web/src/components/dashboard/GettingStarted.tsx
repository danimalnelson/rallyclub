import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@wine-club/ui";
import { Check, Circle, ArrowRight } from "lucide-react";

interface GettingStartedProps {
  businessId: string;
  businessSlug: string | null;
  stripeConnected: boolean;
  hasPlans: boolean;
  hasMembers: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  href?: string;
}

export function GettingStarted({
  businessId,
  businessSlug,
  stripeConnected,
  hasPlans,
  hasMembers,
}: GettingStartedProps) {
  const items: ChecklistItem[] = [
    {
      id: "create-business",
      title: "Create your business",
      description: "Set up your wine club business profile",
      completed: true, // Always true if they're on the dashboard
    },
    {
      id: "connect-stripe",
      title: "Connect Stripe",
      description: "Enable payment processing",
      completed: stripeConnected,
      href: !stripeConnected ? `/app/${businessId}/settings` : undefined,
    },
    {
      id: "create-plan",
      title: "Create a membership plan",
      description: "Set up your first membership tier",
      completed: hasPlans,
      href: !hasPlans ? `/app/${businessId}/memberships/create` : undefined,
    },
    {
      id: "first-member",
      title: "Get your first member",
      description: "Share your page and welcome members",
      completed: hasMembers,
      href: !hasMembers && businessSlug ? `/${businessSlug}` : undefined,
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const allCompleted = completedCount === items.length;
  const progress = (completedCount / items.length) * 100;

  // Don't show if all items are completed
  if (allCompleted) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Getting Started</CardTitle>
            <CardDescription>
              {completedCount} of {items.length} completed
            </CardDescription>
          </div>
          <div className="text-2xl font-bold text-primary">
            {Math.round(progress)}%
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-primary/20 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChecklistItemRow({ item }: { item: ChecklistItem }) {
  const content = (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
        item.completed
          ? "bg-green-50 dark:bg-green-950/30"
          : item.href
          ? "bg-background hover:bg-accent cursor-pointer"
          : "bg-background"
      }`}
    >
      <div className="flex-shrink-0">
        {item.completed ? (
          <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="h-4 w-4 text-white" />
          </div>
        ) : (
          <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
            <Circle className="h-3 w-3 text-muted-foreground/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            item.completed ? "text-green-700 dark:text-green-400 line-through" : ""
          }`}
        >
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground">{item.description}</p>
      </div>
      {!item.completed && item.href && (
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      )}
    </div>
  );

  if (!item.completed && item.href) {
    return (
      <Link href={item.href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
