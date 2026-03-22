"use client";

import { useState } from "react";
import { format, addHours, nextMonday, setHours, setMinutes, setSeconds } from "date-fns";
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  MessageSquare,
  Reply,
  Send,
  Sparkles,
  Star,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  Zap,
  Mail,
  AlertTriangle,
} from "lucide-react";
import { useAppState } from "@/lib/dirac/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/dirac/utils";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  type SnoozeState,
  type DiracThread,
  type RelationshipContext,
  type FounderCategory,
} from "@/lib/dirac/types";
import { useToast } from "@/components/ui/toast";
import type { ToneProfile } from "@/lib/dirac/store";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadView() {
  const {
    selectedThreadId,
    threads,
    messages,
    messagesLoading,
    isInAiContext,
    addToAiContext,
    removeFromAiContext,
    setAiSidebarOpen,
    toggleStarred,
    markDone,
    unmarkDone,
    doneThreads,
    archiveThread,
    snoozeThread,
    snoozedThreads,
    commitments,
    categoryMap,
    toneProfile,
    getRelationshipContext,
  } = useAppState();

  if (!selectedThreadId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Inbox className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Select a thread to read
          </p>
        </div>
      </div>
    );
  }

  const thread = threads.find((t) => t.id === selectedThreadId);
  if (!thread) return null;

  const isDiscord = thread.platform === "DISCORD";
  const inContext = isInAiContext(thread.id);
  const isDone = doneThreads.has(thread.id);
  const threadCommitments = commitments.filter((c) => c.threadId === thread.id);
  const category = categoryMap[thread.id];
  const snoozeState = snoozedThreads.find((s) => s.threadId === thread.id);

  const handleToggleContext = () => {
    if (inContext) {
      removeFromAiContext(thread.id);
    } else {
      addToAiContext({ id: thread.id, label: thread.subject });
      setAiSidebarOpen(true);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Thread header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isDiscord && (
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
            )}
            <h2 className="truncate text-sm font-semibold text-foreground">
              {thread.subject}
            </h2>
            {category && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium shrink-0",
                  FOUNDER_CATEGORY_COLORS[category],
                )}
              >
                {FOUNDER_CATEGORY_LABELS[category]}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {thread.participants.map((p) => p.name).join(", ")}
          </p>
        </div>

        {/* Thread actions */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={inContext ? "default" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleContext}
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {inContext ? "Remove from AI context" : "Add to AI context"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleStarred(thread.id)}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    thread.isStarred
                      ? "fill-yellow-400 text-yellow-400"
                      : "",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {thread.isStarred ? "Unstar" : "Star"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => isDone ? unmarkDone(thread.id) : markDone(thread.id)}
              >
                <CheckCircle2
                  className={cn("h-4 w-4", isDone && "text-green-500")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDone ? "Move to inbox" : "Mark done"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => archiveThread(thread.id)}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Archive</TooltipContent>
          </Tooltip>

          <SnoozeButton threadId={thread.id} onSnooze={snoozeThread} />
        </div>
      </div>

      {/* Snooze banner */}
      {snoozeState && snoozeState.until && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          Snoozed until {format(new Date(snoozeState.until), "EEE, MMM d 'at' h:mm a")}
        </div>
      )}

      {/* Commitments banner */}
      {threadCommitments.length > 0 && (
        <div className="border-b border-border bg-amber-500/5 px-6 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {threadCommitments.length} commitment{threadCommitments.length !== 1 ? "s" : ""}
          </div>
          <div className="mt-1 space-y-1">
            {threadCommitments.map((c) => (
              <div
                key={c.id}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  c.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  c.owner === "me" ? "bg-blue-500" : "bg-amber-500",
                )} />
                <span className="flex-1">{c.description}</span>
                {c.dueDate && (
                  <span className="shrink-0 font-medium">
                    {c.isOverdue ? "Overdue" : format(new Date(c.dueDate), "MMM d")}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sender profile (collapsible) */}
      <SenderProfile
        thread={thread}
        threads={threads}
        toneProfile={toneProfile}
        getRelationshipContext={getRelationshipContext}
      />

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0 px-6 py-4">
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="mb-3 h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No messages found in this thread
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={msg.id}>
                <div className="flex gap-3 py-4">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {getInitials(msg.fromName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {msg.fromName}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {format(new Date(msg.sentAt), "MMM d, h:mm a")}
                      </span>
                    </div>
                    {!isDiscord && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        to{" "}
                        {msg.toAddresses.length > 0
                          ? msg.toAddresses.join(", ")
                          : "..."}
                      </p>
                    )}

                    {msg.bodyHtml ? (
                      <div
                        className="mt-3 prose prose-sm max-w-none text-foreground prose-a:text-primary [&_img]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                      />
                    ) : (
                      <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {msg.bodyText || "(no content)"}
                      </div>
                    )}
                  </div>
                </div>
                {idx < messages.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Quick actions bar */}
      <QuickActions
        threadId={thread.id}
        threadSubject={thread.subject}
        platform={thread.platform}
        participants={thread.participants}
        category={category}
        onOpenAi={() => {
          addToAiContext({ id: thread.id, label: thread.subject });
          setAiSidebarOpen(true);
        }}
      />
    </div>
  );
}

// ─── Sender Profile ──────────────────────────────────────

function SenderProfile({
  thread,
  threads,
  toneProfile,
  getRelationshipContext,
}: {
  thread: DiracThread;
  threads: DiracThread[];
  toneProfile: ToneProfile | null;
  getRelationshipContext: (email: string) => RelationshipContext | null;
}) {
  const [open, setOpen] = useState(false);

  const sender = thread.participants[0];
  if (!sender || thread.platform === "DISCORD") return null;

  const relationshipCtx = getRelationshipContext(sender.email);
  const threadCount = threads.filter((t) =>
    t.participants.some((p) => p.email === sender.email),
  ).length;

  // Find matching conditional tone for this sender
  const matchingTone = toneProfile?.conditional_tones?.find((ct) => {
    const email = sender.email.toLowerCase();
    if (ct.context === "client_customer" && (email.includes("customer") || email.includes("client"))) return true;
    if (ct.context === "internal_team" && email.includes("team")) return true;
    return false;
  });

  const lastContacted = relationshipCtx?.lastContacted
    ? format(new Date(relationshipCtx.lastContacted), "MMM d, yyyy")
    : null;

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-6 py-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors hover:bg-accent/30"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        <span className="font-medium text-foreground">{sender.name || sender.email}</span>
        <span className="text-muted-foreground">&lt;{sender.email}&gt;</span>
        {!open && threadCount > 0 && (
          <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {threadCount} thread{threadCount !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-6 pb-3 pt-1 text-xs">
          <div>
            <span className="text-muted-foreground">Threads: </span>
            <span className="font-medium text-foreground">{threadCount}</span>
          </div>
          {lastContacted && (
            <div>
              <span className="text-muted-foreground">Last contacted: </span>
              <span className="font-medium text-foreground">{lastContacted}</span>
            </div>
          )}
          {matchingTone && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Tone used: </span>
              <span className="font-medium text-foreground capitalize">{matchingTone.formality} · {matchingTone.tone}</span>
            </div>
          )}
          {toneProfile && !matchingTone && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Tone used: </span>
              <span className="font-medium text-foreground capitalize">{toneProfile.formality}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Snooze Button ───────────────────────────────────────

function SnoozeButton({
  threadId,
  onSnooze,
}: {
  threadId: string;
  onSnooze: (threadId: string, snooze: Omit<SnoozeState, "threadId" | "snoozedAt">) => void;
}) {
  const [open, setOpen] = useState(false);

  function snoozeUntil(date: Date, label: string) {
    onSnooze(threadId, { mode: "time", until: date.toISOString(), condition: label });
    setOpen(false);
  }

  const options = [
    {
      label: "Later today",
      description: "+3 hours",
      getDate: () => addHours(new Date(), 3),
    },
    {
      label: "Tomorrow morning",
      description: "9 am tomorrow",
      getDate: () => {
        const d = addHours(new Date(), 24);
        return setSeconds(setMinutes(setHours(d, 9), 0), 0);
      },
    },
    {
      label: "Next week",
      description: "Monday 9 am",
      getDate: () => {
        const monday = nextMonday(new Date());
        return setSeconds(setMinutes(setHours(monday, 9), 0), 0);
      },
    },
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Snooze</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-52 p-1" align="end">
        <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Snooze until…
        </p>
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => snoozeUntil(opt.getDate(), opt.label)}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent transition-colors"
          >
            <span>{opt.label}</span>
            <span className="text-xs text-muted-foreground">{opt.description}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Quick AI Actions ────────────────────────────────────

interface QuickAction {
  id: string;
  label: string;
  icon: typeof ThumbsUp;
  prompt: string;
}

const DEFAULT_ACTIONS: QuickAction[] = [
  {
    id: "ack",
    label: "Acknowledge",
    icon: ThumbsUp,
    prompt: "Send a brief acknowledgment reply — something like 'got it, thanks' in my tone. Keep it to 1-2 sentences max.",
  },
  {
    id: "decline",
    label: "Decline",
    icon: ThumbsDown,
    prompt: "Politely decline or pass on whatever is being asked/offered. Keep it brief and professional in my tone.",
  },
  {
    id: "more_info",
    label: "Ask for details",
    icon: HelpCircle,
    prompt: "Reply asking for more information or clarification about what they're discussing. Keep it concise, in my tone.",
  },
];

const CATEGORY_ACTIONS: Record<FounderCategory, QuickAction[]> = {
  customer: [
    { id: "ack_customer", label: "Acknowledge", icon: ThumbsUp, prompt: "Acknowledge the customer's message warmly. Let them know their message was received and will be addressed." },
    { id: "ask_details", label: "Ask for details", icon: HelpCircle, prompt: "Politely ask the customer for more details to better help them. Be specific about what info would help." },
    { id: "escalate", label: "Escalate internally", icon: Zap, prompt: "Draft a brief internal note about this customer issue to escalate to the team. Summarize the problem and urgency." },
  ],
  investor: [
    { id: "express_interest", label: "Express interest", icon: ThumbsUp, prompt: "Reply expressing interest in what the investor is proposing or discussing. Be professional and enthusiastic." },
    { id: "decline_polite", label: "Politely decline", icon: ThumbsDown, prompt: "Politely decline the investor's offer or proposal. Be respectful, leave the door open for future opportunities." },
    { id: "request_meeting", label: "Request meeting", icon: HelpCircle, prompt: "Reply requesting a meeting or call to discuss further. Suggest a couple of time slots or ask for their availability." },
  ],
  vendor: [
    { id: "ack_vendor", label: "Acknowledge", icon: ThumbsUp, prompt: "Briefly acknowledge the vendor's message. Keep it professional and short." },
    { id: "archive_vendor", label: "Got it, archive", icon: Check, prompt: "Send a brief 'noted, thanks' reply suitable for a vendor/service email." },
    { id: "more_info_vendor", label: "Need more info", icon: HelpCircle, prompt: "Ask the vendor for more details or clarification about their service, pricing, or offer." },
  ],
  outreach: [
    { id: "not_interested", label: "Not interested", icon: ThumbsDown, prompt: "Politely decline this cold outreach. Be brief and clear but not rude." },
    { id: "tell_more", label: "Tell me more", icon: HelpCircle, prompt: "Reply expressing some interest and asking for more specific information about their offer." },
    { id: "schedule_call", label: "Schedule call", icon: Zap, prompt: "Reply suggesting a call to discuss their proposal further. Ask for their availability or suggest a couple of times." },
  ],
  automated: [
    { id: "ack_auto", label: "Acknowledge", icon: ThumbsUp, prompt: "Send a brief acknowledgment if needed." },
  ],
  personal: DEFAULT_ACTIONS,
};

function QuickActions({
  threadId,
  threadSubject,
  platform,
  participants,
  onOpenAi,
  category,
}: {
  threadId: string;
  threadSubject: string;
  platform: string;
  participants: { name: string; email: string }[];
  onOpenAi: () => void;
  category?: FounderCategory;
}) {
  const { toneProfile } = useAppState();
  const { toast } = useToast();
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = category ? (CATEGORY_ACTIONS[category] ?? DEFAULT_ACTIONS) : DEFAULT_ACTIONS;

  const handleQuickAction = async (action: QuickAction) => {
    setSending(action.id);
    setError(null);

    try {
      // Fetch thread messages for context
      const isOutlook = platform === "OUTLOOK";
      const url = isOutlook
        ? `/api/outlook/threads/${threadId}`
        : `/api/gmail/threads/${threadId}`;
      const threadRes = await fetch(url);
      const threadData = threadRes.ok ? await threadRes.json() : null;

      const context = threadData
        ? [
            {
              threadId,
              subject: threadSubject,
              messages: (threadData.messages ?? []).map(
                (m: { fromName: string; bodyText: string; sentAt: string }) => ({
                  from: m.fromName,
                  body: m.bodyText,
                  sentAt: m.sentAt,
                }),
              ),
            },
          ]
        : undefined;

      // Get AI draft
      const aiRes = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: action.prompt,
          context,
          toneProfile: toneProfile ?? undefined,
        }),
      });

      if (!aiRes.ok) throw new Error("AI request failed");

      const reader = aiRes.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
      }

      // Extract draft content from the response
      const draftMatch = accumulated.match(/```draft\n([\s\S]*?)```/);
      const draftBody = draftMatch ? draftMatch[1].trim() : accumulated.trim();

      if (!draftBody) throw new Error("Empty draft");

      // Send the reply
      const recipient = participants[0];
      const sendUrl = isOutlook ? "/api/outlook/send" : "/api/gmail/send";
      const sendPayload = isOutlook
        ? { to: recipient?.email ?? "", subject: threadSubject, body: draftBody }
        : { threadId, to: recipient?.email ?? "", subject: threadSubject, body: draftBody };

      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendPayload),
      });

      if (!sendRes.ok) throw new Error("Send failed");

      setSent(action.id);
      toast({ title: `"${action.label}" reply sent`, variant: "success" });
      setTimeout(() => setSent(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      setError(msg);
      toast({ title: "Reply failed", description: msg, variant: "error" });
      setTimeout(() => setError(null), 3000);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="border-t border-border px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            const isSending = sending === action.id;
            const isSent = sent === action.id;

            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-3 text-xs"
                    onClick={() => handleQuickAction(action)}
                    disabled={!!sending}
                  >
                    {isSending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isSent ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                    {isSent ? "Sent" : action.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  AI generates and sends a &quot;{action.label.toLowerCase()}&quot; reply in your tone
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs"
          onClick={onOpenAi}
        >
          <Sparkles className="h-3 w-3" />
          AI reply
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-3 text-xs text-muted-foreground"
          onClick={onOpenAi}
        >
          <Reply className="h-3 w-3" />
          Full reply
        </Button>

        {error && (
          <span className="text-xs text-red-500 ml-auto">{error}</span>
        )}
      </div>
    </div>
  );
}
