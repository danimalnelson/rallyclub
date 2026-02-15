"use client";

import { useState, useRef } from "react";
import { Button } from "@wine-club/ui";
import { Clock, Forward10Seconds, Calendar } from "geist-icons";

interface TimeControlsProps {
  testClockId: string;
  currentTime: number;
  onTimeAdvanced: () => void;
}

const PRESETS = [
  { label: "+1 Day", seconds: 86400 },
  { label: "+1 Week", seconds: 604800 },
  { label: "+2 Weeks", seconds: 1209600 },
  { label: "+1 Month", seconds: 2592000 },
];

export function TimeControls({ testClockId, currentTime, onTimeAdvanced }: TimeControlsProps) {
  const [loading, setLoading] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Synchronous lock to prevent multiple concurrent advances
  const isAdvancingRef = useRef(false);

  const advanceByDuration = async (seconds: number) => {
    // Synchronous lock to prevent multiple concurrent advances
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/test-clocks/${testClockId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advanceBy: seconds }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to advance time");
      }

      // Wait a moment for Stripe to process, then refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      onTimeAdvanced();
    } catch (err: any) {
      setError(err.message);
    } finally {
      isAdvancingRef.current = false;
      setLoading(false);
    }
  };

  const advanceToDate = async () => {
    if (!customDate) return;
    
    // Synchronous lock
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const targetDate = new Date(customDate);
      
      // Ensure we're advancing forward
      if (targetDate.getTime() / 1000 <= currentTime) {
        throw new Error("Target date must be in the future (relative to test clock)");
      }

      const res = await fetch(`/api/admin/test-clocks/${testClockId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frozenTime: customDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to advance time");
      }

      setCustomDate("");
      await new Promise(resolve => setTimeout(resolve, 1000));
      onTimeAdvanced();
    } catch (err: any) {
      setError(err.message);
    } finally {
      isAdvancingRef.current = false;
      setLoading(false);
    }
  };

  const advanceToNextFirst = async () => {
    // Synchronous lock
    if (isAdvancingRef.current) return;
    isAdvancingRef.current = true;
    
    const currentDate = new Date(currentTime * 1000);
    const nextFirst = new Date(currentDate);
    nextFirst.setMonth(nextFirst.getMonth() + 1);
    nextFirst.setDate(1);
    nextFirst.setHours(0, 0, 0, 0);

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/test-clocks/${testClockId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frozenTime: nextFirst.toISOString() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to advance time");
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      onTimeAdvanced();
    } catch (err: any) {
      setError(err.message);
    } finally {
      isAdvancingRef.current = false;
      setLoading(false);
    }
  };

  const formatCurrentDate = () => {
    return new Date(currentTime * 1000).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getNextFirstOfMonth = () => {
    const currentDate = new Date(currentTime * 1000);
    const nextFirst = new Date(currentDate);
    nextFirst.setMonth(nextFirst.getMonth() + 1);
    nextFirst.setDate(1);
    return nextFirst.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Current Time Display */}
      <div className="bg-muted p-3 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Clock className="w-4 h-4" />
          Current Test Clock Time
        </div>
        <p className="font-medium">{formatCurrentDate()}</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 p-2 rounded text-sm">
          {error}
        </div>
      )}

      {/* Quick Advance Buttons */}
      <div>
        <p className="text-sm font-medium mb-2">Quick Advance</p>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="secondary"
              size="small"
              onClick={() => advanceByDuration(preset.seconds)}
              disabled={loading}
              prefix={<Forward10Seconds className="w-3 h-3" />}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Advance to 1st of Month */}
      <div>
        <p className="text-sm font-medium mb-2">Cohort Billing Day</p>
        <Button
          variant="secondary"
          className="w-full"
          onClick={advanceToNextFirst}
          disabled={loading}
          prefix={<Calendar className="w-4 h-4" />}
        >
          Advance to {getNextFirstOfMonth()} (1st of month)
        </Button>
      </div>

      {/* Custom Date */}
      <div>
        <p className="text-sm font-medium mb-2">Custom Date</p>
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-md text-sm"
            min={new Date(currentTime * 1000).toISOString().slice(0, 16)}
          />
          <Button
            variant="secondary"
            onClick={advanceToDate}
            disabled={loading || !customDate}
          >
            Go
          </Button>
        </div>
      </div>
    </div>
  );
}

