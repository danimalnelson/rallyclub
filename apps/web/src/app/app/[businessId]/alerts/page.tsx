"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@wine-club/ui";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: any;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

interface AlertsResponse {
  alerts: Alert[];
  counts: Record<string, number>;
  total: number;
}

const ALERT_ICONS = {
  MISSING_DYNAMIC_PRICE: "💰",
  FAILED_PAYMENT: "💳",
  SUBSCRIPTION_PAUSED: "⏸️",
  SUBSCRIPTION_CANCELLED: "❌",
  SUBSCRIPTION_PAST_DUE: "⚠️",
};

const SEVERITY_COLORS = {
  INFO: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
  WARNING: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
  URGENT: "bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800",
  CRITICAL: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
};

const SEVERITY_TEXT_COLORS = {
  INFO: "text-blue-800 dark:text-blue-200",
  WARNING: "text-yellow-800 dark:text-yellow-200",
  URGENT: "text-orange-800 dark:text-orange-200",
  CRITICAL: "text-red-800 dark:text-red-200",
};

export default function AlertsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AlertsResponse | null>(null);
  const [filter, setFilter] = useState<"all" | "unresolved">("unresolved");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        businessId,
      });
      
      if (filter === "unresolved") {
        params.append("resolved", "false");
      }
      
      if (typeFilter) {
        params.append("type", typeFilter);
      }

      const response = await fetch(`/api/alerts?${params}`);
      if (response.ok) {
        const data = await response.json();
        setData(data);
      }
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [businessId, filter, typeFilter]);

  const handleResolve = async (alertId: string) => {
    try {
      const response = await fetch(`/api/alerts/${alertId}/resolve`, {
        method: "POST",
      });
      
      if (response.ok) {
        // Refresh alerts
        fetchAlerts();
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    }
  };

  const handleNavigate = (alert: Alert) => {
    if (alert.type === "MISSING_DYNAMIC_PRICE" && alert.metadata?.planId) {
      router.push(`/app/${businessId}/plans/${alert.metadata.planId}/edit`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alerts</h1>
        <p className="text-muted-foreground mt-1">
          Important notifications and action items for your business
        </p>
      </div>

      {/* Summary Cards */}
      {data && data.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setTypeFilter(null)}>
            <CardHeader className="pb-3">
              <CardDescription>Total Alerts</CardDescription>
              <CardTitle className="text-3xl">{data.total}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setTypeFilter(typeFilter === "MISSING_DYNAMIC_PRICE" ? null : "MISSING_DYNAMIC_PRICE")}>
            <CardHeader className="pb-3">
              <CardDescription>💰 Missing Prices</CardDescription>
              <CardTitle className="text-3xl">{data.counts.MISSING_DYNAMIC_PRICE || 0}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setTypeFilter(typeFilter === "FAILED_PAYMENT" ? null : "FAILED_PAYMENT")}>
            <CardHeader className="pb-3">
              <CardDescription>💳 Failed Payments</CardDescription>
              <CardTitle className="text-3xl">{data.counts.FAILED_PAYMENT || 0}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setTypeFilter(typeFilter === "SUBSCRIPTION_PAUSED" ? null : "SUBSCRIPTION_PAUSED")}>
            <CardHeader className="pb-3">
              <CardDescription>⏸️ Paused</CardDescription>
              <CardTitle className="text-3xl">{data.counts.SUBSCRIPTION_PAUSED || 0}</CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setTypeFilter(typeFilter === "SUBSCRIPTION_CANCELLED" ? null : "SUBSCRIPTION_CANCELLED")}>
            <CardHeader className="pb-3">
              <CardDescription>❌ Cancelled</CardDescription>
              <CardTitle className="text-3xl">{data.counts.SUBSCRIPTION_CANCELLED || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "unresolved" ? "default" : "outline"}
            onClick={() => setFilter("unresolved")}
            size="sm"
          >
            Unresolved
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            All
          </Button>
        </div>
        
        {typeFilter && (
          <Button
            variant="ghost"
            onClick={() => setTypeFilter(null)}
            size="sm"
          >
            Clear filter ✕
          </Button>
        )}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading alerts...</p>
            </CardContent>
          </Card>
        )}

        {!loading && data && data.alerts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-lg font-medium">No alerts!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Everything looks good. We'll notify you if anything needs attention.
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && data && data.alerts.map((alert) => (
          <div
            key={alert.id}
            className={`border rounded-lg p-4 ${SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS]}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">
                    {ALERT_ICONS[alert.type as keyof typeof ALERT_ICONS]}
                  </span>
                  <h3 className={`font-semibold ${SEVERITY_TEXT_COLORS[alert.severity as keyof typeof SEVERITY_TEXT_COLORS]}`}>
                    {alert.title}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_TEXT_COLORS[alert.severity as keyof typeof SEVERITY_TEXT_COLORS]}`}>
                    {alert.severity}
                  </span>
                </div>
                <p className={`text-sm ${SEVERITY_TEXT_COLORS[alert.severity as keyof typeof SEVERITY_TEXT_COLORS]}`}>
                  {alert.message}
                </p>
                
                {alert.metadata && alert.type === "MISSING_DYNAMIC_PRICE" && (
                  <div className={`text-xs mt-2 ${SEVERITY_TEXT_COLORS[alert.severity as keyof typeof SEVERITY_TEXT_COLORS]} opacity-75`}>
                    Plan: {alert.metadata.planName} • 
                    Membership: {alert.metadata.membershipName} • 
                    {alert.metadata.activeSubscribers} subscriber(s) • 
                    {alert.metadata.daysRemaining} day(s) remaining
                  </div>
                )}
                
                <div className={`text-xs mt-2 ${SEVERITY_TEXT_COLORS[alert.severity as keyof typeof SEVERITY_TEXT_COLORS]} opacity-50`}>
                  {new Date(alert.createdAt).toLocaleString()}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {alert.type === "MISSING_DYNAMIC_PRICE" && !alert.resolved && (
                  <Button
                    onClick={() => handleNavigate(alert)}
                    size="sm"
                  >
                    Set Price
                  </Button>
                )}
                
                {!alert.resolved && (
                  <Button
                    onClick={() => handleResolve(alert.id)}
                    variant="outline"
                    size="sm"
                  >
                    Resolve
                  </Button>
                )}
                
                {alert.resolved && (
                  <span className="text-xs text-muted-foreground px-3 py-1 bg-green-100 dark:bg-green-900 rounded-full">
                    ✓ Resolved
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

