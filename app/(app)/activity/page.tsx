"use client";

import { useEffect, useState, useCallback } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  FileText,
  Send as SendIcon,
  Inbox,
  Loader2,
  RefreshCw,
  Mail,
  ArrowUpRight,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/dirac/utils";

interface SentItem {
  id: string;
  platform: "GMAIL" | "OUTLOOK";
  to: string[];
  subject: string;
  snippet: string;
  sentAt: string;
}

interface DraftItem {
  id: string;
  platform: "GMAIL" | "OUTLOOK";
  to: string[];
  subject: string;
  snippet: string;
  updatedAt: string;
}

function PlatformBadge({ platform }: { platform: "GMAIL" | "OUTLOOK" }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 px-1.5 text-[10px] font-normal shrink-0",
        platform === "OUTLOOK" && "border-blue-500/20 text-blue-600",
        platform === "GMAIL" && "border-red-500/20 text-red-600",
      )}
    >
      {platform === "GMAIL" ? "Gmail" : "Outlook"}
    </Badge>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sublabel,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  sublabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-foreground tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sublabel && (
          <p className="text-[10px] text-muted-foreground/60">{sublabel}</p>
        )}
      </div>
    </div>
  );
}

function SentRow({ item }: { item: SentItem }) {
  const timeAgo = formatDistanceToNow(new Date(item.sentAt), {
    addSuffix: true,
  });
  const fullDate = format(new Date(item.sentAt), "MMM d, yyyy 'at' h:mm a");
  const recipients = item.to.length > 0 ? item.to.join(", ") : "Unknown";

  return (
    <div className="group flex flex-col gap-2 border-b border-border px-5 py-4 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {recipients}
            </p>
            <p className="text-xs text-muted-foreground" title={fullDate}>
              {timeAgo}
            </p>
          </div>
        </div>
        <PlatformBadge platform={item.platform} />
      </div>

      <div className="pl-[42px]">
        <p className="text-sm text-foreground">{item.subject}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {item.snippet}
        </p>
      </div>
    </div>
  );
}

function DraftRow({ item }: { item: DraftItem }) {
  const timeAgo = formatDistanceToNow(new Date(item.updatedAt), {
    addSuffix: true,
  });
  const fullDate = format(
    new Date(item.updatedAt),
    "MMM d, yyyy 'at' h:mm a",
  );
  const recipients =
    item.to.length > 0 ? item.to.join(", ") : "No recipients yet";

  return (
    <div className="group flex flex-col gap-2 border-b border-border px-5 py-4 transition-colors hover:bg-accent/30">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {recipients}
            </p>
            <p className="text-xs text-muted-foreground" title={fullDate}>
              {timeAgo}
            </p>
          </div>
        </div>
        <PlatformBadge platform={item.platform} />
      </div>

      <div className="pl-[42px]">
        <p className="text-sm text-foreground">{item.subject}</p>
        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
          {item.snippet}
        </p>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [sent, setSent] = useState<SentItem[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loadingSent, setLoadingSent] = useState(true);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [activeTab, setActiveTab] = useState("sent");

  const fetchSent = useCallback(async () => {
    setLoadingSent(true);
    try {
      const res = await fetch("/api/activity/sent");
      if (res.ok) {
        const data = await res.json();
        setSent(data.items ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingSent(false);
    }
  }, []);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch("/api/activity/drafts");
      if (res.ok) {
        const data = await res.json();
        setDrafts(data.items ?? []);
      }
    } catch {
      // silent
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  useEffect(() => {
    fetchSent();
    fetchDrafts();
  }, [fetchSent, fetchDrafts]);

  const refreshCurrent = () => {
    if (activeTab === "sent") fetchSent();
    else fetchDrafts();
  };

  const isLoading = activeTab === "sent" ? loadingSent : loadingDrafts;

  const todaySent = sent.filter((s) => {
    const d = new Date(s.sentAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  return (
    <div className="dirac-panel flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <h1 className="text-sm font-semibold text-foreground">Activity</h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={refreshCurrent}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
          />
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 border-b border-border px-6 py-4">
        <StatCard
          label="Messages sent"
          value={sent.length}
          icon={SendIcon}
          sublabel={
            todaySent.length > 0 ? `${todaySent.length} today` : undefined
          }
        />
        <StatCard label="Drafts" value={drafts.length} icon={FileText} />
        <StatCard
          label="Platforms"
          value={
            new Set([
              ...sent.map((s) => s.platform),
              ...drafts.map((d) => d.platform),
            ]).size
          }
          icon={Mail}
          sublabel="Connected accounts"
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="border-b border-border px-6">
          <TabsList className="h-10 gap-6 bg-transparent p-0">
            <TabsTrigger
              value="sent"
              className="h-10 rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-2.5 text-xs font-medium data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              <SendIcon className="mr-1.5 h-3.5 w-3.5" />
              Sent
              {sent.length > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] tabular-nums">
                  {sent.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="drafts"
              className="h-10 rounded-none border-b-2 border-transparent px-0 pb-2.5 pt-2.5 text-xs font-medium data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              Drafts
              {drafts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] tabular-nums">
                  {drafts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Sent tab */}
        <TabsContent value="sent" className="flex-1 overflow-hidden mt-0">
          {loadingSent ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading sent messages...
              </p>
            </div>
          ) : sent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Inbox className="mb-3 h-12 w-12 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">
                No sent messages yet
              </p>
              <p className="mt-1.5 max-w-xs text-xs text-muted-foreground/60">
                Messages you send through Dirac or your connected email accounts
                will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex flex-col">
                {sent.map((item) => (
                  <SentRow key={`${item.platform}-${item.id}`} item={item} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Drafts tab */}
        <TabsContent value="drafts" className="flex-1 overflow-hidden mt-0">
          {loadingDrafts ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading drafts...
              </p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <Inbox className="mb-3 h-12 w-12 text-muted-foreground/20" />
              <p className="text-sm font-medium text-muted-foreground">
                No drafts
              </p>
              <p className="mt-1.5 max-w-xs text-xs text-muted-foreground/60">
                Drafts from your connected email accounts will appear here
              </p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="flex flex-col">
                {drafts.map((item) => (
                  <DraftRow key={`${item.platform}-${item.id}`} item={item} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
