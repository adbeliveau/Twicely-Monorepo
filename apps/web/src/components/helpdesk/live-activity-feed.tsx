"use client";

import { useState, useEffect, useRef } from "react";
import { ActivityRow } from "@/app/(helpdesk)/hd/dashboard-widgets";

interface ActivityItem {
  type: string;
  agent: string;
  caseNumber: string;
  description: string;
  timeAgo: string;
}

interface LiveActivityFeedProps {
  initialActivity: ActivityItem[];
}

const POLL_INTERVAL_MS = 30_000;

export function LiveActivityFeed({ initialActivity }: LiveActivityFeedProps) {
  const [activity, setActivity] = useState<ActivityItem[]>(initialActivity);
  const [newItemCount, setNewItemCount] = useState(0);
  const prevCaseNumbersRef = useRef(new Set(initialActivity.map((a) => a.caseNumber + a.timeAgo)));

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/hub/helpdesk/activity");
        if (!res.ok) return;
        const data = await res.json() as { activity?: ActivityItem[] };
        const fetched = data.activity ?? [];

        // Detect new items by caseNumber+timeAgo key
        const fetchedKeys = fetched.map((a) => a.caseNumber + a.timeAgo);
        const newKeys = fetchedKeys.filter((k) => !prevCaseNumbersRef.current.has(k));
        if (newKeys.length > 0) {
          setNewItemCount((c) => c + newKeys.length);
          prevCaseNumbersRef.current = new Set(fetchedKeys);
          setActivity(fetched);
        }
      } catch {
        // silently handle
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  function handleAcknowledge() {
    setNewItemCount(0);
  }

  return (
    <div className="relative">
      {newItemCount > 0 && (
        <button
          type="button"
          onClick={handleAcknowledge}
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white animate-slide-down"
          style={{ background: "rgb(59,130,246)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
          {newItemCount} new {newItemCount === 1 ? "event" : "events"}
        </button>
      )}

      {activity.length > 0 ? (
        <div className="space-y-3">
          {activity.map((a, i) => (
            <div key={i} className="animate-fade-in">
              <ActivityRow activity={a} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm py-4 text-center" style={{ color: "rgb(var(--hd-text-muted))" }}>
          No recent activity
        </p>
      )}
    </div>
  );
}
