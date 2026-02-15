"use client";

import { useState, useEffect } from "react";
import { RefreshClockwise, CheckCircle, CrossCircle, Clock, CreditCard, FileText, Warning } from "geist-icons";
import { Button } from "@wine-club/ui";

interface TimelineEvent {
  id: string;
  type: string;
  created: number;
  createdFormatted: string;
  data: any;
}

interface Invoice {
  id: string;
  number: string | null;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  periodStart: number;
  periodEnd: number;
  billingReason: string;
  paid: boolean;
}

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  trialStart: number | null;
  trialEnd: number | null;
  billingCycleAnchor: number;
}

interface Customer {
  id: string;
  email: string;
  subscriptions: Subscription[];
  invoices: Invoice[];
}

interface ClockDetails {
  testClock: {
    id: string;
    frozenTime: number;
    frozenTimeFormatted: string;
  };
  customers: Customer[];
  events: TimelineEvent[];
}

interface EventTimelineProps {
  testClockId: string;
  frozenTime: number; // When this changes, we refetch
}

export function EventTimeline({ testClockId, frozenTime }: EventTimelineProps) {
  const [details, setDetails] = useState<ClockDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/test-clocks/${testClockId}/details`);
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to fetch details");
      }

      setDetails(data);
    } catch (err: any) {
      console.error("[EventTimeline] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when testClockId changes (new scenario) or frozenTime changes (time advanced)
  useEffect(() => {
    // Small delay to let test clock be ready
    const timeout = setTimeout(() => {
      fetchDetails();
    }, 500);
    
    return () => clearTimeout(timeout);
  }, [testClockId, frozenTime]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getEventIcon = (type: string) => {
    if (type.includes("subscription")) {
      return <Clock className="w-4 h-4" />;
    }
    if (type.includes("invoice")) {
      return <FileText className="w-4 h-4" />;
    }
    if (type.includes("payment")) {
      return <CreditCard className="w-4 h-4" />;
    }
    return <Warning className="w-4 h-4" />;
  };

  const getEventColor = (type: string) => {
    if (type.includes("succeeded") || type.includes("paid") || type.includes("created")) {
      return "text-green-600 bg-green-50 dark:bg-green-950";
    }
    if (type.includes("failed") || type.includes("deleted")) {
      return "text-red-600 bg-red-50 dark:bg-red-950";
    }
    if (type.includes("updated")) {
      return "text-blue-600 bg-blue-50 dark:bg-blue-950";
    }
    return "text-gray-600 bg-gray-50 dark:bg-gray-900";
  };

  const getInvoiceStatusIcon = (status: string, paid: boolean) => {
    if (paid || status === "paid") {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (status === "open" || status === "draft") {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    if (status === "uncollectible" || status === "void") {
      return <CrossCircle className="w-4 h-4 text-red-500" />;
    }
    return <FileText className="w-4 h-4 text-gray-500" />;
  };

  if (loading && !details) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshClockwise className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-500 text-sm mb-2">{error}</p>
        <Button variant="secondary" size="small" onClick={fetchDetails}>
          Retry
        </Button>
      </div>
    );
  }

  if (!details) {
    return <p className="text-muted-foreground text-center py-4">No data</p>;
  }

  const customer = details.customers[0];

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="tertiary" size="small" onClick={fetchDetails} disabled={loading} prefix={<RefreshClockwise className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />}>
          Refresh
        </Button>
      </div>

      {/* Invoices Section */}
      {customer && customer.invoices.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Invoices</h4>
          <div className="space-y-2">
            {customer.invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-2 border rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  {getInvoiceStatusIcon(invoice.status, invoice.paid)}
                  <div>
                    <span className="font-mono text-xs">
                      {invoice.number || invoice.id.slice(-8)}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {invoice.billingReason?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {formatCurrency(invoice.amountDue, invoice.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(invoice.created)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription Status */}
      {customer && customer.subscriptions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Subscription</h4>
          {customer.subscriptions.map((sub) => (
            <div key={sub.id} className="p-3 border rounded space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    sub.status === "active"
                      ? "bg-green-100 text-green-700"
                      : sub.status === "trialing"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {sub.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Period</span>
                <span className="font-mono text-xs">
                  {formatDate(sub.currentPeriodStart)} → {formatDate(sub.currentPeriodEnd)}
                </span>
              </div>
              {sub.trialEnd && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Trial Ends</span>
                  <span className="font-mono text-xs">{formatDate(sub.trialEnd)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Billing Anchor</span>
                <span className="font-mono text-xs">
                  {formatDate(sub.billingCycleAnchor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Events */}
      {details.events.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Events</h4>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {details.events.slice(0, 15).map((event) => (
              <div
                key={event.id}
                className={`flex items-start gap-2 p-2 rounded text-xs ${getEventColor(
                  event.type
                )}`}
              >
                {getEventIcon(event.type)}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{event.type}</p>
                  <p className="text-muted-foreground">{formatDate(event.created)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {details.events.length === 0 && (
        <div className="text-center text-sm py-4">
          <p className="text-muted-foreground mb-2">
            No Stripe events captured yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Events may take a few seconds to appear after actions.
            Try clicking Refresh above.
          </p>
        </div>
      )}
    </div>
  );
}

