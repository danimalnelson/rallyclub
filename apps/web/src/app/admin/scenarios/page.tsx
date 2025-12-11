"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@wine-club/ui";
import { Play, Clock, Trash2, ChevronRight, RefreshCw } from "lucide-react";
import { TimeControls } from "./components/TimeControls";
import { EventTimeline } from "./components/EventTimeline";

type ScenarioType = "rolling" | "cohort-immediate" | "cohort-deferred";

interface TestClock {
  id: string;
  name: string;
  frozenTime: number;
  status: string;
  created: number;
}

interface ScenarioResult {
  testClock: {
    id: string;
    name: string;
    frozenTime: number;
    frozenTimeFormatted: string;
  };
  customer: {
    id: string;
    email: string;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: number;
    currentPeriodEnd: number;
    trialEnd: number | null;
    billingCycleAnchor: number;
  };
  nextSteps: string[];
}

const SCENARIOS = [
  {
    type: "rolling" as ScenarioType,
    name: "Rolling Membership",
    description: "Bills immediately on signup, renews on the same day each month (anniversary billing).",
    billingAnchor: "IMMEDIATE",
    chargeImmediately: "n/a",
    color: "bg-blue-500",
  },
  {
    type: "cohort-immediate" as ScenarioType,
    name: "Cohort - Immediate Access",
    description: "Bills immediately, but next bill aligns to the 1st of the month (cohort billing).",
    billingAnchor: "NEXT_INTERVAL",
    chargeImmediately: "true",
    color: "bg-green-500",
  },
  {
    type: "cohort-deferred" as ScenarioType,
    name: "Cohort - Deferred Start",
    description: "Trial until the 1st of the month, then first bill. All members bill on the same day.",
    billingAnchor: "NEXT_INTERVAL",
    chargeImmediately: "false",
    color: "bg-purple-500",
  },
];

export default function ScenariosPage() {
  const [testClocks, setTestClocks] = useState<TestClock[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningScenario, setRunningScenario] = useState<ScenarioType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing test clocks on mount
  useEffect(() => {
    fetchTestClocks();
  }, []);

  const fetchTestClocks = async () => {
    try {
      const res = await fetch("/api/admin/test-clocks");
      const data = await res.json();
      setTestClocks(data.testClocks || []);
    } catch (err) {
      console.error("Failed to fetch test clocks:", err);
    }
  };

  const runScenario = async (type: ScenarioType) => {
    setRunningScenario(type);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/test-clocks/scenarios/${type}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to run scenario");
      }

      setActiveScenario(data);
      await fetchTestClocks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRunningScenario(null);
    }
  };

  const deleteTestClock = async (id: string) => {
    try {
      await fetch(`/api/admin/test-clocks/${id}`, { method: "DELETE" });
      await fetchTestClocks();
      if (activeScenario?.testClock.id === id) {
        setActiveScenario(null);
      }
    } catch (err) {
      console.error("Failed to delete test clock:", err);
    }
  };

  const handleTimeAdvanced = async () => {
    if (activeScenario) {
      // Refresh the scenario details
      try {
        const res = await fetch(`/api/admin/test-clocks/${activeScenario.testClock.id}/details`);
        const data = await res.json();
        
        // Update frozen time
        setActiveScenario((prev) =>
          prev
            ? {
                ...prev,
                testClock: {
                  ...prev.testClock,
                  frozenTime: data.testClock.frozenTime,
                  frozenTimeFormatted: data.testClock.frozenTimeFormatted,
                },
              }
            : null
        );
      } catch (err) {
        console.error("Failed to refresh scenario:", err);
      }
    }
    await fetchTestClocks();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Billing Scenario Testing</h1>
          <p className="text-muted-foreground">
            Use Stripe Test Clocks to simulate subscription lifecycle events without waiting for real time.
          </p>
        </div>

        {error && (
          <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-950">
            <CardContent className="pt-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Scenario Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {SCENARIOS.map((scenario) => (
            <Card
              key={scenario.type}
              className={`relative overflow-hidden ${
                activeScenario && runningScenario !== scenario.type ? "opacity-60" : ""
              }`}
            >
              <div className={`absolute top-0 left-0 right-0 h-1 ${scenario.color}`} />
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {scenario.name}
                  <Button
                    size="sm"
                    onClick={() => runScenario(scenario.type)}
                    disabled={loading}
                  >
                    {runningScenario === scenario.type ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    <span className="ml-2">Run</span>
                  </Button>
                </CardTitle>
                <CardDescription>{scenario.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs font-mono bg-muted p-2 rounded space-y-1">
                  <div>
                    <span className="text-muted-foreground">billingAnchor:</span>{" "}
                    {scenario.billingAnchor}
                  </div>
                  <div>
                    <span className="text-muted-foreground">chargeImmediately:</span>{" "}
                    {scenario.chargeImmediately}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Scenario Details */}
        {activeScenario && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Left: Scenario Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Test Clock
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Time</p>
                  <p className="font-mono text-lg">
                    {formatDate(activeScenario.testClock.frozenTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-mono text-sm">{activeScenario.customer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subscription Status</p>
                  <p className="font-semibold capitalize">{activeScenario.subscription.status}</p>
                </div>
                {activeScenario.subscription.trialEnd && (
                  <div>
                    <p className="text-sm text-muted-foreground">Trial Ends</p>
                    <p className="font-mono text-sm">
                      {formatDate(activeScenario.subscription.trialEnd)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Current Period</p>
                  <p className="font-mono text-sm">
                    {formatDate(activeScenario.subscription.currentPeriodStart)} →{" "}
                    {formatDate(activeScenario.subscription.currentPeriodEnd)}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Next Steps:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {activeScenario.nextSteps.map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Middle: Time Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Advance Time</CardTitle>
                <CardDescription>
                  Move the test clock forward to trigger billing events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TimeControls
                  testClockId={activeScenario.testClock.id}
                  currentTime={activeScenario.testClock.frozenTime}
                  onTimeAdvanced={handleTimeAdvanced}
                />
              </CardContent>
            </Card>

            {/* Right: Event Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Event Timeline</CardTitle>
                <CardDescription>
                  Stripe events triggered by time advancement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EventTimeline testClockId={activeScenario.testClock.id} />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Existing Test Clocks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Existing Test Clocks
              <Button variant="outline" size="sm" onClick={fetchTestClocks}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testClocks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No test clocks. Run a scenario to create one.
              </p>
            ) : (
              <div className="space-y-2">
                {testClocks.map((clock) => (
                  <div
                    key={clock.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{clock.name || clock.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Frozen at: {formatDate(clock.frozenTime)} • Status: {clock.status}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteTestClock(clock.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
