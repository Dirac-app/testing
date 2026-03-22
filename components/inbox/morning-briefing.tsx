"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Clock,
  Reply,
  Sun,
  Sunrise,
  Moon,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useAppState } from "@/lib/dirac/store";
import { cn } from "@/lib/dirac/utils";

interface Briefing {
  greeting: string;
  summary: string;
  highlights: string[];
  urgentCount: number;
  needsReplyCount: number;
  staleCount: number;
  commitmentsDueCount: number;
}

function getTimeIcon() {
  const hour = new Date().getHours();
  if (hour < 12) return Sunrise;
  if (hour < 18) return Sun;
  return Moon;
}

export function MorningBriefing() {
  const {
    threads,
    triageMap,
    doneThreads,
    snoozedThreads,
    commitments,
  } = useAppState();

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const snoozedIds = new Set(snoozedThreads.map((s) => s.threadId));

  const activeThreads = threads.filter(
    (t) => !doneThreads.has(t.id) && !snoozedIds.has(t.id),
  );

  const needsReplyCount = activeThreads.filter(
    (t) => triageMap[t.id] === "needs_reply",
  ).length;
  const waitingOnCount = activeThreads.filter(
    (t) => triageMap[t.id] === "waiting_on",
  ).length;

  const now = Date.now();
  const STALE_DAYS = 3;
  const staleThreads = activeThreads
    .filter((t) => {
      const age = (now - new Date(t.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24);
      return age > STALE_DAYS && (triageMap[t.id] === "needs_reply" || triageMap[t.id] === "waiting_on");
    })
    .map((t) => ({
      subject: t.subject,
      sender: t.participants[0]?.name ?? "Unknown",
      staleDays: Math.floor(
        (now - new Date(t.lastMessageAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const commitmentsDue = commitments.filter(
    (c) =>
      c.dueDate &&
      new Date(c.dueDate).getTime() >= todayStart.getTime() &&
      new Date(c.dueDate).getTime() <= todayEnd.getTime(),
  );

  const urgentThreads = activeThreads
    .filter((t) => t.isUrgent)
    .map((t) => ({
      subject: t.subject,
      sender: t.participants[0]?.name ?? "Unknown",
    }));

  const snoozedResurfacing = snoozedThreads.filter(
    (s) =>
      s.mode === "time" &&
      s.until &&
      new Date(s.until).getTime() >= todayStart.getTime() &&
      new Date(s.until).getTime() <= todayEnd.getTime(),
  ).length;

  const fetchBriefing = useCallback(async () => {
    if (activeThreads.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          needsReplyCount,
          waitingOnCount,
          staleThreads: staleThreads.slice(0, 5),
          snoozedResurfacing,
          commitmentsDue: commitmentsDue.slice(0, 5),
          urgentThreads: urgentThreads.slice(0, 5),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      }
    } catch {} finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, [needsReplyCount, waitingOnCount, staleThreads, snoozedResurfacing, commitmentsDue, urgentThreads, activeThreads.length]);

  useEffect(() => {
    if (
      !hasLoaded &&
      !loading &&
      activeThreads.length > 0 &&
      Object.keys(triageMap).length > 0
    ) {
      fetchBriefing();
    }
  }, [hasLoaded, loading, activeThreads.length, triageMap, fetchBriefing]);

  if (dismissed || (!briefing && !loading)) return null;

  const TimeIcon = getTimeIcon();

  return (
    <div className="relative mx-4 mb-3 rounded-lg border border-border bg-gradient-to-r from-primary/5 to-transparent p-4">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-accent"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing your briefing...
        </div>
      ) : briefing ? (
        <>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <TimeIcon className="h-4 w-4 text-primary" />
            {briefing.greeting}
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {briefing.summary}
          </p>

          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {briefing.needsReplyCount > 0 && (
              <div className="flex items-center gap-1 text-blue-600">
                <Reply className="h-3 w-3" />
                {briefing.needsReplyCount} need reply
              </div>
            )}
            {staleThreads.length > 0 && (
              <div className="flex items-center gap-1 text-amber-600">
                <Clock className="h-3 w-3" />
                {staleThreads.length} going stale
              </div>
            )}
            {briefing.urgentCount > 0 && (
              <div className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-3 w-3" />
                {briefing.urgentCount} urgent
              </div>
            )}
            {commitmentsDue.length > 0 && (
              <div className="flex items-center gap-1 text-purple-600">
                <AlertTriangle className="h-3 w-3" />
                {commitmentsDue.length} commitment{commitmentsDue.length !== 1 ? "s" : ""} due
              </div>
            )}
          </div>

          {briefing.highlights.length > 0 && (
            <ul className="mt-2 space-y-1">
              {briefing.highlights.map((h, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-xs text-muted-foreground"
                >
                  <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
