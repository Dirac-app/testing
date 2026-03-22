"use client";

import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useRef, useCallback } from "react";
import {
  Mail,
  MessageSquare,
  Star,
  AlertTriangle,
  Clock,
  Inbox,
  RefreshCw,
  PenSquare,
  Archive,
  Trash2,
  MailOpen,
  MailX,
  BrainCircuit,
  FileText,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/dirac/utils";
import { useAppState } from "@/lib/dirac/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { DiracThread, InboxFilter, TopicTag } from "@/lib/dirac/types";
import { TOPIC_TAG_LABELS, TOPIC_TAG_COLORS } from "@/lib/dirac/types";

const FILTER_TABS: { value: InboxFilter; label: string }[] = [
  { value: "all",        label: "All"       },
  { value: "unread",     label: "Unread"    },
  { value: "urgent",     label: "Urgent"    },
  { value: "waiting_on", label: "Waiting"   },
  { value: "starred",    label: "Starred"   },
];

// ─── Individual thread row ───────────────────────────────

function ThreadRow({
  thread,
  isSelected,
  isBulkSelected,
  onSelect,
  onBulkToggle,
  compact,
  bulkThreads,
}: {
  thread: DiracThread;
  isSelected: boolean;
  isBulkSelected: boolean;
  onSelect: () => void;
  onBulkToggle: (e: React.MouseEvent) => void;
  compact: boolean;
  bulkThreads: DiracThread[];
}) {
  const {
    toggleStarred,
    toggleUrgent,
    markThreadUnread,
    markThreadRead,
    trashThread,
    toggleAiContext,
    isInAiContext,
    setAiSidebarOpen,
    addToAiContext,
    setPendingAiQuery,
    topicMap,
    snoozedThreads,
  } = useAppState();

  const sender = thread.participants[0]?.name ?? thread.participants[0]?.email ?? "Unknown";
  const isSnoozed = snoozedThreads.some((s) => s.threadId === thread.id);
  const timeAgo = formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false });
  const topics = (topicMap[thread.id] ?? []) as TopicTag[];

  const hasBulk = isBulkSelected && bulkThreads.length > 1;
  const targets = hasBulk ? bulkThreads : [thread];

  const py = compact ? "py-2" : "py-3";

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          onClick={onSelect}
          className={cn(
            "group relative flex flex-col gap-1 border-b border-border px-4 text-left transition-colors w-full",
            py,
            isSelected     ? "bg-accent/60" : "hover:bg-accent/30",
            isBulkSelected ? "bg-primary/5"  : "",
          )}
        >
          {/* Selected indicator */}
          {isSelected && <div className="absolute left-0 top-0 h-full w-0.5 bg-primary" />}

          {/* Top row: platform icon + sender + star + time */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">

              {/* Bulk checkbox — shows on hover or when bulk-selected */}
              <div
                role="button"
                tabIndex={0}
                onClick={onBulkToggle}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onBulkToggle(e as unknown as React.MouseEvent); }}
                className={cn(
                  "shrink-0 transition-opacity",
                  isBulkSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                )}
              >
                {isBulkSelected
                  ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  : <Square className="h-3.5 w-3.5 text-muted-foreground" />
                }
              </div>

              {/* Platform icon */}
              {thread.platform === "DISCORD" ? (
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              ) : thread.platform === "OUTLOOK" ? (
                <Mail className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              ) : (
                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}

              <span className={cn(
                "truncate text-sm",
                thread.isUnread ? "font-semibold text-foreground" : "text-foreground",
              )}>
                {sender}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {thread.isUrgent && <AlertTriangle className="h-3 w-3 text-red-500" />}
              {isSnoozed && <Clock className="h-3 w-3 text-amber-500" />}

              {/* Star */}
              <div
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); toggleStarred(thread.id); }}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); toggleStarred(thread.id); }}}
                className={cn(
                  "rounded p-0.5 transition-opacity cursor-pointer",
                  thread.isStarred ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                <Star className={cn(
                  "h-3 w-3 transition-colors",
                  thread.isStarred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400",
                )} />
              </div>

              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>
          </div>

          {/* Subject + topic pills */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn(
              "truncate text-sm",
              thread.isUnread ? "font-medium text-foreground" : "text-muted-foreground",
            )}>
              {thread.subject}
            </span>
            {topics.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                {topics.map(tag => (
                  <span
                    key={tag}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-medium leading-none",
                      TOPIC_TAG_COLORS[tag] ?? "text-muted-foreground bg-muted",
                    )}
                  >
                    {TOPIC_TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Snippet (hidden in compact mode) */}
          {!compact && (
            <div className="truncate text-xs text-muted-foreground">{thread.snippet}</div>
          )}

          {/* Unread dot */}
          {thread.isUnread && (
            <div className="absolute right-3 top-3.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {hasBulk && (
          <>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {targets.length} threads selected
            </div>
            <ContextMenuSeparator />
          </>
        )}

        <ContextMenuItem
          onClick={() => {
            for (const t of targets) {
              addToAiContext({ id: t.id, label: t.subject });
            }
            const subjects = targets.map(t => `"${t.subject}"`).join(", ");
            setPendingAiQuery(
              targets.length === 1
                ? `Summarize the thread ${subjects} — key points, action items, and what needs a response.`
                : `Summarize these ${targets.length} threads: ${subjects}. For each, give key points, action items, and what needs a response.`
            );
            setAiSidebarOpen(true);
          }}
        >
          <FileText className="h-4 w-4" />
          Summarize{hasBulk ? ` ${targets.length} threads` : ""}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => targets.forEach(t => toggleStarred(t.id))}>
          <Star className={cn("h-4 w-4", !hasBulk && thread.isStarred && "fill-yellow-400 text-yellow-400")} />
          {!hasBulk && thread.isStarred ? "Unstar" : "Star"}
        </ContextMenuItem>

        <ContextMenuItem onClick={() => targets.forEach(t => markThreadRead(t.id))}>
          <MailOpen className="h-4 w-4" /> Mark as read
        </ContextMenuItem>

        <ContextMenuItem onClick={() => targets.forEach(t => markThreadUnread(t.id))}>
          <MailX className="h-4 w-4" /> Mark as unread
        </ContextMenuItem>

        <ContextMenuItem onClick={() => targets.forEach(t => toggleUrgent(t.id))}>
          <AlertTriangle className={cn("h-4 w-4", !hasBulk && thread.isUrgent && "text-red-500")} />
          {!hasBulk && thread.isUrgent ? "Remove urgent" : "Mark as urgent"}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => targets.forEach(t => toggleAiContext({ id: t.id, label: t.subject }))}>
          <BrainCircuit className="h-4 w-4" />
          Add to AI context
        </ContextMenuItem>

        {targets.every(t => t.platform !== "DISCORD") && (
          <ContextMenuItem variant="destructive" onClick={() => targets.forEach(t => trashThread(t.id))}>
            <Trash2 className="h-4 w-4" /> Delete{hasBulk ? ` ${targets.length} threads` : ""}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Bulk actions toolbar ────────────────────────────────

function BulkToolbar({
  count,
  onMarkRead,
  onArchive,
  onTrash,
  onClear,
}: {
  count: number;
  onMarkRead: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border bg-accent/40 px-2 py-1.5">
      <span className="text-[11px] font-medium text-foreground mr-auto shrink-0">
        {count} selected
      </span>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onMarkRead} title="Mark as read">
        <MailOpen className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onArchive} title="Archive">
        <Archive className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-red-600 hover:text-red-600" onClick={onTrash} title="Delete">
        <Trash2 className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClear} title="Clear selection">
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Main ThreadList ─────────────────────────────────────

export function ThreadList() {
  const {
    threads,
    threadsLoading,
    selectedThreadId,
    setSelectedThreadId,
    inboxFilter,
    setInboxFilter,
    refreshThreads,
    setComposeOpen,
    setComposeMinimized,
    triageMap,
    searchQuery,
    density,
    selectedThreadIds,
    toggleBulkSelect,
    selectAll,
    clearSelection,
    markThreadRead,
    archiveThread,
    trashThread,
  } = useAppState();

  const lastClickedIdxRef = useRef<number | null>(null);

  // Apply filter + search
  const filtered = threads.filter(t => {
    const matchesFilter =
      inboxFilter === "unread"     ? t.isUnread :
      inboxFilter === "starred"    ? t.isStarred :
      inboxFilter === "urgent"     ? t.isUrgent :
      inboxFilter === "waiting_on" ? triageMap[t.id] === "waiting_on" :
      true;

    if (!matchesFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.participants.some(p =>
          p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
        )
      );
    }

    return true;
  });

  const urgentCount    = threads.filter(t => t.isUrgent).length;
  const unreadCount    = threads.filter(t => t.isUnread).length;
  const waitingCount   = threads.filter(t => triageMap[t.id] === "waiting_on").length;
  const bulkCount      = selectedThreadIds.size;
  const compact        = density === "compact";
  const bulkThreads    = threads.filter(t => selectedThreadIds.has(t.id));

  // Shift-click range select
  const handleSelect = useCallback((idx: number, threadId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedIdxRef.current !== null) {
      const from = Math.min(lastClickedIdxRef.current, idx);
      const to   = Math.max(lastClickedIdxRef.current, idx);
      const idsInRange = filtered.slice(from, to + 1).map(t => t.id);
      selectAll(idsInRange);
    } else {
      setSelectedThreadId(threadId);
      clearSelection();
    }
    lastClickedIdxRef.current = idx;
  }, [filtered, selectAll, setSelectedThreadId, clearSelection]);

  const handleBulkMarkRead = () => {
    selectedThreadIds.forEach(id => markThreadRead(id));
    clearSelection();
  };
  const handleBulkArchive = () => {
    selectedThreadIds.forEach(id => archiveThread(id));
    clearSelection();
  };
  const handleBulkTrash = () => {
    selectedThreadIds.forEach(id => trashThread(id));
    clearSelection();
  };

  return (
    <div className="flex h-full w-80 flex-col border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="text-sm font-semibold text-foreground">Inbox</h1>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">
            {filtered.length} thread{filtered.length !== 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => { setComposeOpen(true); setComposeMinimized(false); }}
            title="Compose"
          >
            <PenSquare className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            onClick={refreshThreads}
            disabled={threadsLoading}
            title="Refresh"
          >
            <RefreshCw className={cn("h-3 w-3", threadsLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0.5 border-b border-border px-2 py-1.5 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map(f => (
          <button
            key={f.value}
            onClick={() => setInboxFilter(f.value)}
            className={cn(
              "relative whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors shrink-0",
              inboxFilter === f.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {f.label}
            {f.value === "unread" && unreadCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/80 px-1 text-[10px] font-semibold text-primary-foreground">
                {unreadCount}
              </span>
            )}
            {f.value === "urgent" && urgentCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {urgentCount}
              </span>
            )}
            {f.value === "waiting_on" && waitingCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk toolbar */}
      {bulkCount > 0 && (
        <BulkToolbar
          count={bulkCount}
          onMarkRead={handleBulkMarkRead}
          onArchive={handleBulkArchive}
          onTrash={handleBulkTrash}
          onClear={clearSelection}
        />
      )}

      {/* Thread list */}
      <ScrollArea className="flex-1">
        {threadsLoading && threads.length === 0 ? (
          <div className="flex flex-col">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-border px-4 py-3 animate-pulse">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3.5 w-3.5 rounded bg-muted" />
                    <div className="h-3 rounded bg-muted" style={{ width: `${60 + (i * 17) % 60}px` }} />
                  </div>
                  <div className="h-3 w-10 rounded bg-muted" />
                </div>
                <div className="h-3 rounded bg-muted" style={{ width: `${120 + (i * 31) % 100}px` }} />
                <div className="h-3 w-full rounded bg-muted opacity-50" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center gap-4">
              <Inbox className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No accounts connected</p>
                <p className="mt-1 text-xs text-muted-foreground/60">Connect Gmail or Outlook to get started</p>
              </div>
              <Button size="sm" asChild>
                <Link href="/settings">Connect an account →</Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Inbox className="mb-3 h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">
                {inboxFilter === "starred"    ? "No starred threads"             :
                 inboxFilter === "urgent"     ? "No urgent threads"              :
                 inboxFilter === "waiting_on" ? "Nothing waiting on a response"  :
                                               "No threads match this filter"   }
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col">
            {filtered.map((thread, idx) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                isSelected={thread.id === selectedThreadId}
                isBulkSelected={selectedThreadIds.has(thread.id)}
                compact={compact}
                bulkThreads={bulkThreads}
                onSelect={() => setSelectedThreadId(thread.id)}
                onBulkToggle={e => {
                  e.stopPropagation();
                  if (e.shiftKey && lastClickedIdxRef.current !== null) {
                    const from = Math.min(lastClickedIdxRef.current, idx);
                    const to   = Math.max(lastClickedIdxRef.current, idx);
                    const idsInRange = filtered.slice(from, to + 1).map(t => t.id);
                    selectAll(idsInRange);
                  } else {
                    toggleBulkSelect(thread.id);
                  }
                  lastClickedIdxRef.current = idx;
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
