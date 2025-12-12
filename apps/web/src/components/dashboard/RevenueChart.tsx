"use client";

import { Card, CardContent, CardHeader, CardTitle, formatCurrency } from "@wine-club/ui";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface ChartDataPoint {
  month: string;
  value: number;
  label: string;
}

interface RevenueChartProps {
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  mrrHistory: Array<{ month: string; mrr: number }>;
  currency: string;
}

export function RevenueChart({ monthlyRevenue, mrrHistory, currency }: RevenueChartProps) {
  // Format month for display (YYYY-MM -> "Jan", "Feb", etc.)
  const formatMonth = (month: string) => {
    const date = new Date(month + "-01");
    return date.toLocaleDateString("en-US", { month: "short" });
  };

  // Prepare data for charts
  const revenueData: ChartDataPoint[] = monthlyRevenue.map(({ month, revenue }) => ({
    month,
    value: revenue,
    label: formatMonth(month),
  }));

  const mrrData: ChartDataPoint[] = mrrHistory.map(({ month, mrr }) => ({
    month,
    value: mrr,
    label: formatMonth(month),
  }));

  const hasData = monthlyRevenue.length > 0 && monthlyRevenue.some(d => d.revenue > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center text-muted-foreground">
            <p>Revenue data will appear here once you have transactions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* MRR Trend Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">MRR Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mrrData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCompact(value, currency)}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ChartDataPoint;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-2 text-sm">
                          <p className="font-medium">{data.label}</p>
                          <p className="text-primary">
                            {formatCurrency(data.value, currency)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Revenue Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Monthly Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatCompact(value, currency)}
                  width={50}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ChartDataPoint;
                      return (
                        <div className="bg-background border rounded-lg shadow-lg p-2 text-sm">
                          <p className="font-medium">{data.label}</p>
                          <p className="text-green-600">
                            {formatCurrency(data.value, currency)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="value" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Format large numbers compactly (e.g., $1.2k, $15k)
 */
function formatCompact(value: number, currency: string): string {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(0)}k`;
  }
  if (value >= 10000) {
    return `${(value / 100).toFixed(0)}`;
  }
  if (value >= 1000) {
    return `${(value / 100).toFixed(0)}`;
  }
  return `${Math.round(value / 100)}`;
}
