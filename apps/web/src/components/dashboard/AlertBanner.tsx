import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
}

interface AlertBannerProps {
  alerts: Alert[];
  businessId: string;
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-500",
    text: "text-red-800 dark:text-red-200",
  },
  URGENT: {
    bg: "bg-orange-50 dark:bg-orange-950",
    border: "border-orange-500",
    text: "text-orange-800 dark:text-orange-200",
  },
  WARNING: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    border: "border-yellow-500",
    text: "text-yellow-800 dark:text-yellow-200",
  },
  INFO: {
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-500",
    text: "text-blue-800 dark:text-blue-200",
  },
};

export function AlertBanner({ alerts, businessId }: AlertBannerProps) {
  if (alerts.length === 0) {
    return null;
  }

  // Get the most severe alert to determine banner style
  const severityOrder = ["CRITICAL", "URGENT", "WARNING", "INFO"];
  const mostSevereAlert = alerts.reduce((most, alert) => {
    const mostIndex = severityOrder.indexOf(most.severity);
    const currentIndex = severityOrder.indexOf(alert.severity);
    return currentIndex < mostIndex ? alert : most;
  }, alerts[0]);

  const styles = SEVERITY_STYLES[mostSevereAlert.severity] || SEVERITY_STYLES.WARNING;

  return (
    <div
      className={`${styles.bg} ${styles.border} border-l-4 rounded-lg p-4 mb-6`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 ${styles.text} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h3 className={`font-semibold ${styles.text}`}>
              {alerts.length === 1
                ? mostSevereAlert.title
                : `${alerts.length} items need your attention`}
            </h3>
            <Link
              href={`/app/${businessId}/alerts`}
              className={`text-sm font-medium ${styles.text} hover:underline whitespace-nowrap`}
            >
              View all
            </Link>
          </div>
          <p className={`text-sm ${styles.text} opacity-90 mt-1`}>
            {alerts.length === 1
              ? mostSevereAlert.message
              : getAlertsSummary(alerts)}
          </p>
        </div>
      </div>
    </div>
  );
}

function getAlertsSummary(alerts: Alert[]): string {
  const typeCounts: Record<string, number> = {};
  
  alerts.forEach((alert) => {
    const type = alert.type.replace(/_/g, " ").toLowerCase();
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });

  const parts = Object.entries(typeCounts).map(
    ([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`
  );

  return parts.join(", ");
}
