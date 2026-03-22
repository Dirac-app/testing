"use client";

import { Zap, X, Check, Archive, Star, Mail, AlertTriangle } from "lucide-react";
import { useAppState } from "@/lib/dirac/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/dirac/utils";

const ACTION_ICONS = {
  archive: Archive,
  star: Star,
  mark_read: Mail,
  mark_urgent: AlertTriangle,
};

const ACTION_LABELS = {
  archive: "Auto-archive",
  star: "Auto-star",
  mark_read: "Auto-mark read",
  mark_urgent: "Auto-mark urgent",
};

export function PatternSuggestions() {
  const { patternSuggestions, dismissPattern, applyPattern } = useAppState();

  if (patternSuggestions.length === 0) return null;

  return (
    <div className="mx-4 mb-3 space-y-2">
      {patternSuggestions.slice(0, 3).map((suggestion) => {
        const Icon = ACTION_ICONS[suggestion.suggestedAction] ?? Zap;
        return (
          <div
            key={suggestion.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-gradient-to-r from-violet-500/5 to-transparent px-3 py-2"
          >
            <Icon className="h-4 w-4 shrink-0 text-violet-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {suggestion.pattern}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {suggestion.senderName} &middot;{" "}
                {ACTION_LABELS[suggestion.suggestedAction]}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => applyPattern(suggestion.id)}
                title="Apply rule"
              >
                <Check className="h-3.5 w-3.5 text-green-500" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => dismissPattern(suggestion.id)}
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
