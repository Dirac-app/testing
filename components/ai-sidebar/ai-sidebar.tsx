"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import {
  Sparkles,
  X,
  Send,
  Plus,
  Mail,
  MessageSquare,
  Check,
  Trash2,
  Eye,
  Loader2,
  Copy,
  CornerUpRight,
  PenSquare,
  Star,
  StarOff,
  Archive,
  MailOpen,
  MailX,
  AlertTriangle,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  Inbox,
  User,
  History,
  ChevronDown,
} from "lucide-react";
import { useAppState } from "@/lib/dirac/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/dirac/utils";
import {
  FOUNDER_CATEGORY_LABELS,
  FOUNDER_CATEGORY_COLORS,
  TOPIC_TAG_LABELS,
  TOPIC_TAG_COLORS,
} from "@/lib/dirac/types";
import type { TopicTag } from "@/lib/dirac/types";
import {
  parseAiContent,
  type McqQuestion,
  type ComposeData,
  type ActionItem,
  type ResultItem,
  type ParsedSegment,
} from "@/lib/dirac/ai-parser";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  context?: string[];
  segments?: ParsedSegment[];
  mcqAnswered?: boolean;
}

// ─── Chat session (history) ─────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const CHAT_SESSIONS_KEY = "dirac_chat_sessions";
const ACTIVE_CHAT_KEY = "dirac_active_chat";

function generateChatId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function deriveChatTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content.slice(0, 50);
  return text.length < firstUser.content.length ? text + "..." : text;
}

function loadChatSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChatSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
  } catch {}
}

function loadActiveChatId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_CHAT_KEY);
  } catch {
    return null;
  }
}

function saveActiveChatId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, id);
    else localStorage.removeItem(ACTIVE_CHAT_KEY);
  } catch {}
}

// parseAiContent is imported from @/lib/ai-parser

// ─── Component ──────────────────────────────────────────

export function AiSidebar() {
  const router = useRouter();
  const {
    aiSidebarOpen,
    setAiSidebarOpen,
    selectedThreadId,
    setSelectedThreadId,
    threads,
    aiContext,
    addToAiContext,
    toggleAiContext,
    removeFromAiContext,
    toneProfile,
    toggleStarred,
    toggleUrgent,
    markThreadRead,
    markThreadUnread,
    archiveThread,
    trashThread,
    setComposeOpen,
    setComposeMinimized,
    pendingAiQuery,
    setPendingAiQuery,
    triageMap,
    categoryMap,
    topicMap,
    commitments,
    selectedThreadIds,
  } = useAppState();

  // ─── Chat session management ────────────────────────────
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    const loaded = loadChatSessions();
    setSessions(loaded);
    const savedId = loadActiveChatId();
    if (savedId && loaded.some((s) => s.id === savedId)) {
      setActiveChatId(savedId);
    }
  }, []);

  const activeSession = sessions.find((s) => s.id === activeChatId);
  const chatMessages = activeSession?.messages ?? [];

  const setChatMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setSessions((prevSessions) => {
        let currentId = activeChatId;

        if (!currentId) {
          currentId = generateChatId();
          setActiveChatId(currentId);
          saveActiveChatId(currentId);
        }

        const now = new Date().toISOString();
        const existing = prevSessions.find((s) => s.id === currentId);
        const prevMessages = existing?.messages ?? [];
        const nextMessages =
          typeof updater === "function" ? updater(prevMessages) : updater;

        const title = deriveChatTitle(nextMessages);

        const updatedSession: ChatSession = existing
          ? { ...existing, messages: nextMessages, title, updatedAt: now }
          : { id: currentId!, title, messages: nextMessages, createdAt: now, updatedAt: now };

        const next = [
          updatedSession,
          ...prevSessions.filter((s) => s.id !== currentId),
        ];
        saveChatSessions(next);
        return next;
      });
    },
    [activeChatId],
  );

  const handleNewChat = useCallback(() => {
    const id = generateChatId();
    setActiveChatId(id);
    saveActiveChatId(id);
    setHistoryOpen(false);
  }, []);

  const handleSwitchChat = useCallback((id: string) => {
    setActiveChatId(id);
    saveActiveChatId(id);
    setHistoryOpen(false);
  }, []);

  const handleDeleteChat = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const next = prev.filter((s) => s.id !== id);
        saveChatSessions(next);
        return next;
      });
      if (activeChatId === id) {
        setActiveChatId(null);
        saveActiveChatId(null);
      }
    },
    [activeChatId],
  );

  const [input, setInput] = useState("");
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState<string | null>(null);
  const [sendingDraft, setSendingDraft] = useState<string | null>(null);
  const [sentDraft, setSentDraft] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const isStreamingRef = useRef(false);
  const chatMessagesRef = useRef(chatMessages);
  chatMessagesRef.current = chatMessages;

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Close context picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node)
      ) {
        setContextPickerOpen(false);
      }
    }
    if (contextPickerOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [contextPickerOpen]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // ─── Pick up pending AI query from spotlight ───────────
  useEffect(() => {
    if (!pendingAiQuery || !aiSidebarOpen || isStreamingRef.current) return;

    const query = pendingAiQuery;
    setPendingAiQuery(null);

    // Build thread summaries with category/triage metadata for batch intelligence
    const threadSummaries = threads.slice(0, 20).map((t) => ({
      threadId: t.id,
      subject: t.subject,
      messages: [
        {
          from: t.participants[0]?.name ?? "Unknown",
          body: t.snippet,
          sentAt: t.lastMessageAt,
        },
      ],
      category: categoryMap[t.id],
      triage: triageMap[t.id],
      lastMessageAt: t.lastMessageAt,
    }));

    const userMsg: ChatMessage = {
      role: "user",
      content: query,
    };

    setChatMessages((prev) => {
      const next = [...prev, userMsg, { role: "assistant" as const, content: "", segments: [] }];
      const insertIdx = next.length - 1;

      // Fire the streaming request
      (async () => {
        isStreamingRef.current = true;
        setIsStreaming(true);
        try {
          const res = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: query,
              context: threadSummaries.length > 0 ? threadSummaries : undefined,
              toneProfile: toneProfile ?? undefined,
            }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "AI request failed" }));
            setChatMessages((prev2) => {
              const updated = [...prev2];
              updated[insertIdx] = {
                role: "assistant",
                content: err.error || "Something went wrong.",
                segments: [{ type: "text", content: err.error || "Something went wrong." }],
              };
              return updated;
            });
            return;
          }

          const reader = res.body?.getReader();
          if (!reader) return;
          const decoder = new TextDecoder();
          let accumulated = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            const current = accumulated;
            setChatMessages((prev2) => {
              const updated = [...prev2];
              updated[insertIdx] = {
                role: "assistant",
                content: current,
                segments: parseAiContent(current),
              };
              return updated;
            });
          }
          setChatMessages((prev2) => {
            const updated = [...prev2];
            updated[insertIdx] = {
              role: "assistant",
              content: accumulated,
              segments: parseAiContent(accumulated),
            };
            return updated;
          });
        } catch {
          setChatMessages((prev2) => {
            const updated = [...prev2];
            updated[insertIdx] = {
              role: "assistant",
              content: "Failed to reach AI.",
              segments: [{ type: "text", content: "Failed to reach AI." }],
            };
            return updated;
          });
        } finally {
          isStreamingRef.current = false;
          setIsStreaming(false);
        }
      })();

      return next;
    });
  }, [pendingAiQuery, aiSidebarOpen, threads, toneProfile, setPendingAiQuery, categoryMap, triageMap]);

  // ─── Build context payload ────────────────────────────
  const buildContextPayload = async () => {
    const contextPayload = aiContext.map((ctx) => {
      const thread = threads.find((t) => t.id === ctx.id);
      return {
        threadId: ctx.id,
        subject: ctx.label,
        messages: thread
          ? thread.participants.map((p) => ({
              from: p.name,
              body: "",
              sentAt: thread.lastMessageAt,
            }))
          : [],
        category: thread ? categoryMap[thread.id] : undefined,
        triage: thread ? triageMap[thread.id] : undefined,
        lastMessageAt: thread?.lastMessageAt,
      };
    });

    return Promise.all(
      contextPayload.map(async (ctx) => {
        try {
          const thread = threads.find((t) => t.id === ctx.threadId);
          const platform = thread?.platform;
          const url =
            platform === "DISCORD"
              ? `/api/discord/threads/${ctx.threadId}`
              : platform === "OUTLOOK"
                ? `/api/outlook/threads/${ctx.threadId}`
                : `/api/gmail/threads/${ctx.threadId}`;
          const res = await fetch(url);
          if (!res.ok) return ctx;
          const data = await res.json();
          return {
            threadId: ctx.threadId,
            subject: ctx.subject,
            messages: (data.messages ?? []).map(
              (m: { fromName: string; bodyText: string; sentAt: string }) => ({
                from: m.fromName,
                body: m.bodyText,
                sentAt: m.sentAt,
              }),
            ),
            category: ctx.category,
            triage: ctx.triage,
            lastMessageAt: ctx.lastMessageAt,
          };
        } catch {
          return ctx;
        }
      }),
    );
  };

  // ─── Stream AI response ───────────────────────────────
  const streamAiResponse = async (
    prompt: string,
    fullContext: Awaited<ReturnType<typeof buildContextPayload>>,
    insertIdx: number,
  ) => {
    setIsStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          context: fullContext.length > 0 ? fullContext : undefined,
          toneProfile: toneProfile ?? undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "AI request failed" }));
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[insertIdx] = {
            role: "assistant",
            content: err.error || "Something went wrong. Check your API key in Settings.",
            segments: [{ type: "text", content: err.error || "Something went wrong." }],
          };
          return updated;
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const current = accumulated;
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[insertIdx] = {
            role: "assistant",
            content: current,
            segments: parseAiContent(current),
          };
          return updated;
        });
      }

      // Final parse
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[insertIdx] = {
          role: "assistant",
          content: accumulated,
          segments: parseAiContent(accumulated),
        };
        return updated;
      });
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[insertIdx] = {
          role: "assistant",
          content: "Failed to reach AI. Check your connection and API key.",
          segments: [{ type: "text", content: "Failed to reach AI. Check your connection and API key." }],
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // ─── Send user message ────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const contextLabels = aiContext.map((c) => c.label);
    const userMsg: ChatMessage = {
      role: "user",
      content: input.trim(),
      context: contextLabels.length > 0 ? contextLabels : undefined,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    const prompt = input.trim();
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const fullContext = await buildContextPayload();

    const insertIdx = chatMessages.length + 1; // after user msg
    setChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", segments: [] },
    ]);

    await streamAiResponse(prompt, fullContext, insertIdx);
  };

  // ─── Handle MCQ answer ────────────────────────────────
  const handleMcqAnswer = async (
    msgIdx: number,
    answers: Record<string, string>,
  ) => {
    // Mark MCQ as answered
    setChatMessages((prev) => {
      const updated = [...prev];
      updated[msgIdx] = { ...updated[msgIdx], mcqAnswered: true };
      return updated;
    });

    // Build a user message with the answers
    const answerText = Object.entries(answers)
      .map(([, value]) => value)
      .join(", ");

    const userMsg: ChatMessage = {
      role: "user",
      content: answerText,
    };

    setChatMessages((prev) => [...prev, userMsg]);

    const fullContext = await buildContextPayload();

    const insertIdx = chatMessages.length + 2; // after updated msg + user answer
    setChatMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", segments: [] },
    ]);

    await streamAiResponse(
      `My answers: ${answerText}`,
      fullContext,
      insertIdx,
    );
  };

  // ─── Copy draft to clipboard ──────────────────────────
  const handleCopyDraft = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedDraft(text);
    setTimeout(() => setCopiedDraft(null), 2000);
  };

  // ─── Send draft via the appropriate platform ──────────
  const handleSendDraft = async (text: string) => {
    // Determine target from the first context thread
    const targetCtx = aiContext[0];
    if (!targetCtx) {
      // No context thread — fall back to copy
      await handleCopyDraft(text);
      return;
    }

    const targetThread = threads.find((t) => t.id === targetCtx.id);
    if (!targetThread) {
      await handleCopyDraft(text);
      return;
    }

    setSendingDraft(text);

    try {
      if (targetThread.platform === "DISCORD") {
        const channelId = targetThread.id.replace(/^discord-/, "");
        const res = await fetch("/api/discord/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId, content: text }),
        });
        if (!res.ok) throw new Error("Discord send failed");
      } else if (targetThread.platform === "OUTLOOK") {
        const lastParticipant = targetThread.participants[0];
        const res = await fetch("/api/outlook/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: lastParticipant?.email ?? "",
            subject: targetThread.subject,
            body: text,
          }),
        });
        if (!res.ok) throw new Error("Outlook send failed");
      } else {
        // Gmail: reply to the thread
        const lastParticipant = targetThread.participants[0];
        const res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: targetThread.id,
            to: lastParticipant?.email ?? "",
            subject: targetThread.subject,
            body: text,
          }),
        });
        if (!res.ok) throw new Error("Gmail send failed");
      }

      setSentDraft(text);
      setTimeout(() => setSentDraft(null), 3000);
    } catch (err) {
      console.error("Send draft error:", err);
      // Fall back to copy on failure
      await handleCopyDraft(text);
    } finally {
      setSendingDraft(null);
    }
  };

  // ─── Handle compose from AI ──────────────────────────
  const handleCompose = (data: ComposeData) => {
    setComposeOpen(true);
    setComposeMinimized(false);
    // Dispatch a custom event so the compose panel can pick up the pre-filled data
    window.dispatchEvent(
      new CustomEvent("dirac:prefill-compose", { detail: data }),
    );
  };

  // ─── Handle inbox actions from AI ───────────────────
  const handleExecuteActions = (items: ActionItem[]) => {
    for (const item of items) {
      switch (item.action) {
        case "star":
        case "unstar":
          toggleStarred(item.threadId);
          break;
        case "mark_read":
          markThreadRead(item.threadId);
          break;
        case "mark_unread":
          markThreadUnread(item.threadId);
          break;
        case "mark_urgent":
        case "remove_urgent":
          toggleUrgent(item.threadId);
          break;
        case "archive":
          archiveThread(item.threadId);
          break;
        case "trash":
          trashThread(item.threadId);
          break;
      }
    }
  };

  // ─── Clear chat (start fresh) ─────────────────────────
  const handleClearChat = () => {
    handleNewChat();
  };

  // ─── Close history on outside click ────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    if (historyOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [historyOpen]);

  // Resolve a thread ID — the AI may hallucinate IDs, so fall back to matching by subject
  const resolveThreadId = useCallback(
    (threadId: string, subject?: string, from?: string): string | null => {
      if (threads.some((t) => t.id === threadId)) return threadId;
      // Fallback: match by subject
      if (subject) {
        const subjectLower = subject.toLowerCase();
        const match = threads.find((t) =>
          t.subject.toLowerCase().includes(subjectLower) ||
          subjectLower.includes(t.subject.toLowerCase()),
        );
        if (match) return match.id;
      }
      // Fallback: match by sender name
      if (from) {
        const fromLower = from.toLowerCase();
        const match = threads.find((t) =>
          t.participants.some(
            (p) =>
              p.name.toLowerCase().includes(fromLower) ||
              p.email.toLowerCase().includes(fromLower),
          ),
        );
        if (match) return match.id;
      }
      return null;
    },
    [threads],
  );

  // Preview a thread in the center column
  const handlePreviewThread = useCallback(
    (threadId: string, subject?: string, from?: string) => {
      const realId = resolveThreadId(threadId, subject, from);
      if (realId) {
        router.push("/inbox");
        setSelectedThreadId(realId);
      }
    },
    [resolveThreadId, router, setSelectedThreadId],
  );

  // Available threads for context picker
  const availableThreads = threads.map((t) => ({
    id: t.id,
    label: t.subject,
    platform: t.platform,
  }));

  const hasContext = aiContext.length > 0;

  // Current thread for contextual suggestions
  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  const handleSuggestionClick = (prompt: string) => {
    if (selectedThread && !aiContext.some((c) => c.id === selectedThread.id)) {
      addToAiContext({ id: selectedThread.id, label: selectedThread.subject });
    }
    setInput("");
    setPendingAiQuery(prompt);
  };

  const handleInboxSuggestionClick = (prompt: string) => {
    setInput("");
    setPendingAiQuery(prompt);
  };

  if (!aiSidebarOpen) return null;

  const nonEmptySessions = sessions.filter((s) => s.messages.length > 0);

  return (
    <div className="dirac-panel ai-panel-glow flex w-80 flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="ai-glow-header flex h-[49px] items-center justify-between border-b border-border px-3">
        <div className="relative flex items-center gap-2 min-w-0" ref={historyRef}>
          <Sparkles className="ai-sparkle-glow h-4 w-4 text-primary shrink-0" />

          {/* Chat title / selector */}
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="flex items-center gap-1 min-w-0 group"
          >
            <span className="text-sm font-semibold text-foreground truncate max-w-[140px]">
              {chatMessages.length > 0 && activeSession
                ? activeSession.title.slice(0, 24) + (activeSession.title.length > 24 ? "..." : "")
                : "AI"
              }
            </span>
            <ChevronDown className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform",
              historyOpen && "rotate-180",
            )} />
          </button>

          {/* History dropdown */}
          <AnimatePresence>
            {historyOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover shadow-lg"
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Chat history</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-[11px]"
                    onClick={handleNewChat}
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {nonEmptySessions.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No past chats
                    </div>
                  ) : (
                    nonEmptySessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          "group flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50",
                          session.id === activeChatId && "bg-accent/60",
                        )}
                      >
                        <button
                          onClick={() => handleSwitchChat(session.id)}
                          className="flex min-w-0 flex-1 flex-col text-left"
                        >
                          <span className="text-[12px] font-medium text-foreground truncate">
                            {session.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(session.id);
                          }}
                          className="shrink-0 rounded p-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-red-500 transition-opacity"
                          title="Delete chat"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setHistoryOpen(!historyOpen)}
            title="Chat history"
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleNewChat}
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setAiSidebarOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Chat transcript ────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 px-3 py-3">
          {chatMessages.length === 0 ? (
            <SidebarIdleState
              threads={threads}
              selectedThread={selectedThread ?? null}
              triageMap={triageMap}
              categoryMap={categoryMap}
              topicMap={topicMap}
              commitments={commitments}
              selectedThreadIds={selectedThreadIds}
              onSuggestionClick={handleSuggestionClick}
              onInboxSuggestionClick={handleInboxSuggestionClick}
            />
          ) : (
            chatMessages.map((msg, idx) => (
              <ChatBubble
                key={idx}
                msg={msg}
                msgIdx={idx}
                isStreaming={isStreaming && idx === chatMessages.length - 1}
                selectedThreadId={selectedThreadId}
                copiedDraft={copiedDraft}
                sendingDraft={sendingDraft}
                sentDraft={sentDraft}
                hasContext={hasContext}
                onMcqAnswer={handleMcqAnswer}
                onCopyDraft={handleCopyDraft}
                onSendDraft={handleSendDraft}
                onCompose={handleCompose}
                onExecuteActions={handleExecuteActions}
                onViewThread={handlePreviewThread}
              />
            ))
          )}
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>

      {/* ─── Input area ──────────────────────────────────── */}
      <div className="border-t border-border ai-glow-input">
        {/* Context chips */}
        {hasContext && (
          <div className="flex flex-wrap gap-1 px-3 pt-2">
            {aiContext.map((ctx) => {
              const isViewing = ctx.id === selectedThreadId;
              return (
                <span
                  key={ctx.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors",
                    isViewing
                      ? "bg-primary/15 text-foreground"
                      : "bg-accent text-accent-foreground",
                  )}
                >
                  <button
                    onClick={() => handlePreviewThread(ctx.id)}
                    className="inline-flex items-center gap-1 hover:underline"
                    title="Preview this thread"
                  >
                    <Mail className="h-2.5 w-2.5 shrink-0 opacity-60" />
                    <span className="max-w-[120px] truncate">{ctx.label}</span>
                  </button>
                  <button
                    onClick={() => removeFromAiContext(ctx.id)}
                    className="ml-0.5 rounded-sm opacity-40 hover:opacity-100"
                    title="Remove from context"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Textarea */}
        <div className="px-3 pt-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              hasContext
                ? "Ask about this thread..."
                : selectedThread
                  ? `Ask about "${selectedThread.subject.slice(0, 30)}..."`
                  : "Ask anything..."
            }
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "24px", maxHeight: "120px" }}
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1.5">
          {/* Left: context controls */}
          <div className="relative flex items-center gap-1" ref={pickerRef}>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setContextPickerOpen(!contextPickerOpen)}
              disabled={threads.length === 0}
            >
              <Plus className="h-3 w-3" />
              Context
            </Button>

            {/* Context picker popover */}
            {contextPickerOpen && (
              <div className="absolute bottom-full left-0 z-50 mb-1 w-72 rounded-lg border border-border bg-popover shadow-md">
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                  Select threads as context
                </div>
                <div className="max-h-56 overflow-y-auto border-t border-border">
                  {availableThreads.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                      No threads available
                    </div>
                  ) : (
                    availableThreads.map((item) => {
                      const isSelected = aiContext.some(
                        (c) => c.id === item.id,
                      );
                      return (
                        <div
                          key={item.id}
                          className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50"
                        >
                          <button
                            onClick={() =>
                              toggleAiContext({
                                id: item.id,
                                label: item.label,
                              })
                            }
                            className="shrink-0"
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border transition-colors",
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border hover:border-muted-foreground",
                              )}
                            >
                              {isSelected && (
                                <Check className="h-2.5 w-2.5" />
                              )}
                            </div>
                          </button>

                          <button
                            onClick={() => {
                              handlePreviewThread(item.id);
                              setContextPickerOpen(false);
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            {item.platform === "DISCORD" ? (
                              <MessageSquare className="h-3 w-3 shrink-0 text-indigo-500" />
                            ) : (
                              <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                            )}
                            <span className="truncate text-xs text-foreground">
                              {item.label}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              handlePreviewThread(item.id);
                              setContextPickerOpen(false);
                            }}
                            className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-foreground"
                            title="Preview thread"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: send */}
          <Button
            size="sm"
            className="h-7 w-7 p-0 ai-send-glow"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── ChatBubble sub-component ───────────────────────────

function ChatBubble({
  msg,
  msgIdx,
  isStreaming,
  selectedThreadId,
  copiedDraft,
  sendingDraft,
  sentDraft,
  hasContext,
  onMcqAnswer,
  onCopyDraft,
  onSendDraft,
  onCompose,
  onExecuteActions,
  onViewThread,
}: {
  msg: ChatMessage;
  msgIdx: number;
  isStreaming: boolean;
  selectedThreadId: string | null;
  copiedDraft: string | null;
  sendingDraft: string | null;
  sentDraft: string | null;
  hasContext: boolean;
  onMcqAnswer: (msgIdx: number, answers: Record<string, string>) => void;
  onCopyDraft: (text: string) => void;
  onSendDraft: (text: string) => void;
  onCompose: (data: ComposeData) => void;
  onExecuteActions: (items: ActionItem[]) => void;
  onViewThread: (threadId: string, subject?: string, from?: string) => void;
}) {
  const [mcqSelections, setMcqSelections] = useState<Record<string, string>>({});

  if (msg.role === "user") {
    return (
      <div className="flex flex-col gap-1">
        {msg.context && msg.context.length > 0 && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/60 mr-1">
            <Mail className="h-2.5 w-2.5" />
            {msg.context.length === 1
              ? msg.context[0].slice(0, 30) +
                (msg.context[0].length > 30 ? "..." : "")
              : `${msg.context.length} threads`}
          </div>
        )}
        <div className="ml-8 rounded-lg bg-primary px-3 py-2 text-[13px] leading-relaxed text-primary-foreground">
          <div className="whitespace-pre-wrap">{msg.content}</div>
        </div>
      </div>
    );
  }

  // Assistant message — render segments
  const segments = msg.segments ?? parseAiContent(msg.content);

  return (
    <div className="flex flex-col gap-2">
      {segments.map((seg, segIdx) => {
        if (seg.type === "mcq" && seg.mcq) {
          return (
            <McqBlock
              key={segIdx}
              questions={seg.mcq}
              answered={msg.mcqAnswered ?? false}
              selections={mcqSelections}
              onSelect={(qId, option) => {
                setMcqSelections((prev) => ({ ...prev, [qId]: option }));
              }}
              onSubmit={() => onMcqAnswer(msgIdx, mcqSelections)}
              isStreaming={isStreaming}
            />
          );
        }

        if (seg.type === "draft") {
          return (
            <DraftBlock
              key={segIdx}
              content={seg.content}
              isCopied={copiedDraft === seg.content}
              isSending={sendingDraft === seg.content}
              isSent={sentDraft === seg.content}
              hasContext={hasContext}
              onCopy={() => onCopyDraft(seg.content)}
              onSend={() => onSendDraft(seg.content)}
            />
          );
        }

        if (seg.type === "compose" && seg.compose) {
          return (
            <ComposeBlock
              key={segIdx}
              data={seg.compose}
              onOpen={() => onCompose(seg.compose!)}
            />
          );
        }

        if (seg.type === "actions" && seg.actions) {
          return (
            <ActionsBlock
              key={segIdx}
              items={seg.actions}
              onExecute={() => onExecuteActions(seg.actions!)}
            />
          );
        }

        if (seg.type === "results" && seg.results) {
          return (
            <ResultsBlock
              key={segIdx}
              items={seg.results}
              onViewThread={onViewThread}
            />
          );
        }

        // Rendered markdown
        return (
          <div
            key={segIdx}
            className="mr-2 rounded-lg bg-muted px-3 py-2 text-[13px] leading-relaxed text-foreground prose prose-sm prose-neutral dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1"
          >
            <ReactMarkdown>{seg.content}</ReactMarkdown>
          </div>
        );
      })}

      {/* Streaming indicator when content is empty */}
      {isStreaming && segments.length === 0 && (
        <div className="mr-2 rounded-lg bg-muted px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

// ─── MCQ Block ──────────────────────────────────────────

function McqBlock({
  questions,
  answered,
  selections,
  onSelect,
  onSubmit,
  isStreaming,
}: {
  questions: McqQuestion[];
  answered: boolean;
  selections: Record<string, string>;
  onSelect: (questionId: string, option: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
}) {
  const allAnswered = questions.every((q) => selections[q.id]);

  return (
    <div className="mr-2 space-y-3 rounded-lg border border-border bg-muted/50 px-3 py-3">
      {questions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          <p className="text-[12px] font-medium text-foreground">
            {q.question}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {q.options.map((opt) => {
              const isSelected = selections[q.id] === opt;
              return (
                <button
                  key={opt}
                  onClick={() => !answered && onSelect(q.id, opt)}
                  disabled={answered}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                    answered && isSelected
                      ? "border-primary bg-primary/10 text-primary"
                      : answered
                        ? "border-border text-muted-foreground opacity-50"
                        : isSelected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground hover:border-primary/50 hover:bg-primary/5",
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {!answered && (
        <Button
          size="sm"
          className="h-7 w-full text-xs"
          onClick={onSubmit}
          disabled={!allAnswered || isStreaming}
        >
          {isStreaming ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <CornerUpRight className="mr-1.5 h-3 w-3" />
          )}
          Continue
        </Button>
      )}
    </div>
  );
}

// ─── Draft Block ────────────────────────────────────────

function DraftBlock({
  content,
  isCopied,
  isSending,
  isSent,
  hasContext,
  onCopy,
  onSend,
}: {
  content: string;
  isCopied: boolean;
  isSending: boolean;
  isSent: boolean;
  hasContext: boolean;
  onCopy: () => void;
  onSend: () => void;
}) {
  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-primary/20">
      {/* Draft header */}
      <div className="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-primary/70">
          Draft
        </span>
        {isSent && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <Check className="h-3 w-3" />
            Sent
          </span>
        )}
      </div>

      {/* Draft body */}
      <div className="bg-muted/30 px-3 py-2.5">
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {content}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 border-t border-primary/10 bg-primary/5 px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={onCopy}
          disabled={isSending}
        >
          {isCopied ? (
            <>
              <Check className="h-3 w-3 text-green-600" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={onSend}
          disabled={isSending || isSent}
        >
          {isSending ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Sending...
            </>
          ) : isSent ? (
            <>
              <Check className="h-3 w-3" />
              Sent
            </>
          ) : (
            <>
              <Send className="h-3 w-3" />
              {hasContext ? "Send" : "Copy"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Compose Block ──────────────────────────────────────

function ComposeBlock({
  data,
  onOpen,
}: {
  data: ComposeData;
  onOpen: () => void;
}) {
  const [opened, setOpened] = useState(false);

  const handleOpen = () => {
    onOpen();
    setOpened(true);
  };

  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-blue-500/20">
      <div className="flex items-center justify-between border-b border-blue-500/10 bg-blue-500/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-blue-600/70">
          New email
        </span>
        {opened && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <Check className="h-3 w-3" />
            Opened
          </span>
        )}
      </div>

      <div className="bg-muted/30 px-3 py-2.5 space-y-1.5">
        {data.to && (
          <div className="text-[11px]">
            <span className="text-muted-foreground">To: </span>
            <span className="text-foreground">{data.to}</span>
          </div>
        )}
        <div className="text-[11px]">
          <span className="text-muted-foreground">Subject: </span>
          <span className="text-foreground font-medium">{data.subject}</span>
        </div>
        <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground pt-1 border-t border-border/50">
          {data.body}
        </div>
      </div>

      <div className="flex items-center gap-1.5 border-t border-blue-500/10 bg-blue-500/5 px-3 py-1.5">
        <Button
          variant="default"
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={handleOpen}
          disabled={opened}
        >
          {opened ? (
            <>
              <Check className="h-3 w-3" />
              Opened in Compose
            </>
          ) : (
            <>
              <PenSquare className="h-3 w-3" />
              Open in Compose
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Actions Block ──────────────────────────────────────

const ACTION_META: Record<string, { icon: typeof Star; label: string; color: string }> = {
  star: { icon: Star, label: "Star", color: "text-yellow-500" },
  unstar: { icon: StarOff, label: "Unstar", color: "text-muted-foreground" },
  mark_read: { icon: MailOpen, label: "Mark read", color: "text-muted-foreground" },
  mark_unread: { icon: MailX, label: "Mark unread", color: "text-blue-500" },
  mark_urgent: { icon: AlertTriangle, label: "Mark urgent", color: "text-red-500" },
  remove_urgent: { icon: AlertTriangle, label: "Remove urgent", color: "text-muted-foreground" },
  archive: { icon: Archive, label: "Archive", color: "text-muted-foreground" },
  trash: { icon: Trash2, label: "Trash", color: "text-red-500" },
};

function ActionsBlock({
  items,
  onExecute,
}: {
  items: ActionItem[];
  onExecute: () => void;
}) {
  const [executed, setExecuted] = useState(false);

  const handleExecute = () => {
    onExecute();
    setExecuted(true);
  };

  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-orange-500/20">
      <div className="flex items-center justify-between border-b border-orange-500/10 bg-orange-500/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-orange-600/70">
          {items.length} action{items.length !== 1 ? "s" : ""}
        </span>
        {executed && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Done
          </span>
        )}
      </div>

      <div className="bg-muted/30 divide-y divide-border/50">
        {items.map((item, i) => {
          const meta = ACTION_META[item.action] || {
            icon: Mail,
            label: item.action,
            color: "text-muted-foreground",
          };
          const Icon = meta.icon;

          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5">
              <Icon className={cn("h-3 w-3 shrink-0", meta.color)} />
              <span className="text-[11px] text-muted-foreground shrink-0">
                {meta.label}
              </span>
              <span className="text-[12px] text-foreground truncate">
                {item.subject}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 border-t border-orange-500/10 bg-orange-500/5 px-3 py-1.5">
        <Button
          variant="default"
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={handleExecute}
          disabled={executed}
        >
          {executed ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Applied
            </>
          ) : (
            <>
              <PlayCircle className="h-3 w-3" />
              Apply all
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Results Block (search results) ─────────────────────

function ResultsBlock({
  items,
  onViewThread,
}: {
  items: ResultItem[];
  onViewThread: (threadId: string, subject?: string, from?: string) => void;
}) {
  return (
    <div className="mr-2 overflow-hidden rounded-lg border border-blue-500/20">
      <div className="border-b border-blue-500/10 bg-blue-500/5 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-blue-600/70">
          {items.length} result{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-muted/30 divide-y divide-border/50">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onViewThread(item.threadId, item.subject, item.from)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/50"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-foreground">
                {item.subject}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {item.from} &middot; {item.reason}
              </p>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar Idle State (insight cards + suggestions) ────

import type {
  DiracThread,
  TriageCategory,
  FounderCategory,
  Commitment,
} from "@/lib/dirac/types";

function SidebarIdleState({
  threads,
  selectedThread,
  triageMap,
  categoryMap,
  topicMap,
  commitments,
  selectedThreadIds,
  onSuggestionClick,
  onInboxSuggestionClick,
}: {
  threads: DiracThread[];
  selectedThread: DiracThread | null;
  triageMap: Record<string, TriageCategory>;
  categoryMap: Record<string, FounderCategory>;
  topicMap: Record<string, TopicTag[]>;
  commitments: Commitment[];
  selectedThreadIds: Set<string>;
  onSuggestionClick: (prompt: string) => void;
  onInboxSuggestionClick: (prompt: string) => void;
}) {
  const [bulkCardIndex, setBulkCardIndex] = useState(0);

  const bulkThreads = threads.filter((t) => selectedThreadIds.has(t.id));
  const hasBulk = bulkThreads.length > 1;

  // Reset index when selection changes
  useEffect(() => {
    setBulkCardIndex(0);
  }, [selectedThreadIds.size]);

  const activeThread = hasBulk ? bulkThreads[bulkCardIndex] : selectedThread;

  const category = activeThread ? categoryMap[activeThread.id] : undefined;
  const topics = activeThread ? ((topicMap[activeThread.id] ?? []) as TopicTag[]) : [];
  const triage = activeThread ? triageMap[activeThread.id] : undefined;
  const threadCommitments = activeThread
    ? commitments.filter((c) => c.threadId === activeThread.id)
    : [];
  const sender = activeThread?.participants[0];

  const threadSuggestions = activeThread
    ? hasBulk
      ? [
          { label: `Summarize all ${bulkThreads.length} threads`, prompt: `Summarize these ${bulkThreads.length} threads: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. For each, give key points and action items.` },
          { label: "Compare these threads", prompt: `Compare these ${bulkThreads.length} threads: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. What do they have in common? Any patterns?` },
          { label: "Draft batch reply", prompt: `Draft brief replies for each of these ${bulkThreads.length} threads: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. Keep each concise and in my tone.` },
          { label: "Prioritize these", prompt: `Rank these ${bulkThreads.length} threads by urgency: ${bulkThreads.map((t) => `"${t.subject}"`).join(", ")}. Which should I handle first and why?` },
        ]
      : [
          { label: "Summarize", prompt: `Summarize the thread "${activeThread.subject}" — key points, action items, and what needs a response.` },
          { label: "Draft a reply", prompt: `Draft a reply to "${activeThread.subject}" in my tone. Keep it concise.` },
          { label: "Extract action items", prompt: `What action items or commitments are in the thread "${activeThread.subject}"? List who owes what.` },
          { label: "What's the tone?", prompt: `Analyze the tone and sentiment of the thread "${activeThread.subject}". Is the sender happy, frustrated, neutral?` },
          { label: "Follow-up needed?", prompt: `For the thread "${activeThread.subject}" — do I need to follow up? If yes, suggest what to say.` },
        ]
    : [];

  const inboxSuggestions = [
    { label: "What needs my attention?", prompt: "What emails need my attention most urgently? Consider unread threads, anything awaiting my reply, and upcoming deadlines." },
    { label: "Summarize my inbox", prompt: "Give me a brief summary of my inbox — how many unread, what's urgent, and any patterns you notice." },
    { label: "Find unanswered threads", prompt: "Find threads where someone is waiting for my reply. List them with the sender and how long they've been waiting." },
    { label: "Draft a new email", prompt: "I want to compose a new email. Ask me who it's to, what it's about, and the tone I want." },
  ];

  const handleFlick = (direction: 1 | -1) => {
    setBulkCardIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return bulkThreads.length - 1;
      if (next >= bulkThreads.length) return 0;
      return next;
    });
  };

  return (
    <div className="relative flex flex-col gap-3 px-1 py-3 min-h-[400px]">
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
        <div className="ai-orb ai-orb-1" />
        <div className="ai-orb ai-orb-2" />
        <div className="ai-orb ai-orb-3" />
      </div>

      {/* Bulk card stack OR single thread snapshot */}
      <AnimatePresence mode="wait">
        {hasBulk ? (
          <div key="bulk-stack" className="relative z-10 mx-1">
            {/* Stacked card shadows behind */}
            <div className="absolute inset-0 top-1 rounded-lg border border-border/30 bg-background/40 backdrop-blur-sm translate-x-1 translate-y-1" />
            {bulkThreads.length > 2 && (
              <div className="absolute inset-0 top-1 rounded-lg border border-border/20 bg-background/20 backdrop-blur-sm translate-x-2 translate-y-2" />
            )}

            {/* Active card */}
            <motion.div
              key={activeThread?.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative rounded-lg border border-border/60 bg-background/90 backdrop-blur-sm p-3 ai-glow-card"
            >
              {/* Navigation header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                    <Inbox className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {bulkCardIndex + 1} / {bulkThreads.length} selected
                  </span>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => handleFlick(-1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3 rotate-180" />
                  </button>
                  <button
                    onClick={() => handleFlick(1)}
                    className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Card content */}
              {activeThread && (
                <ThreadCardContent
                  thread={activeThread}
                  category={category}
                  triage={triage}
                  topics={topics}
                  commitments={threadCommitments}
                  sender={sender}
                />
              )}
            </motion.div>

            {/* Dot indicators */}
            <div className="flex items-center justify-center gap-1 mt-2">
              {bulkThreads.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setBulkCardIndex(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === bulkCardIndex
                      ? "w-4 bg-primary"
                      : "w-1.5 bg-muted-foreground/20 hover:bg-muted-foreground/40",
                  )}
                />
              ))}
            </div>
          </div>
        ) : activeThread ? (
          <motion.div
            key={activeThread.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative z-10 mx-1 rounded-lg border border-border/60 bg-background/80 backdrop-blur-sm p-3 ai-glow-card"
          >
            <ThreadCardContent
              thread={activeThread}
              category={category}
              triage={triage}
              topics={topics}
              commitments={threadCommitments}
              sender={sender}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Suggestion chips — thread-specific */}
      {activeThread && (
        <div className="relative z-10 flex flex-col gap-1 mt-1">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-0.5"
          >
            {hasBulk ? `${bulkThreads.length} threads` : "This thread"}
          </motion.p>
          {threadSuggestions.map((chip, i) => (
            <motion.button
              key={chip.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, ease: "easeOut", delay: 0.1 + i * 0.04 }}
              onClick={() => onSuggestionClick(chip.prompt)}
              className="ai-chip-shimmer flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-accent/60"
            >
              <ArrowRight className="h-3 w-3 shrink-0 text-primary/40" />
              {chip.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Suggestion chips — general / inbox */}
      <div className="relative z-10 flex flex-col gap-1 mt-1">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: activeThread ? 0.35 : 0.15 }}
          className="px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 mb-0.5"
        >
          General
        </motion.p>
        {inboxSuggestions.map((chip, i) => (
          <motion.button
            key={chip.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: (activeThread ? 0.35 : 0.1) + i * 0.04 }}
            onClick={() => onInboxSuggestionClick(chip.prompt)}
            className="ai-chip-shimmer flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
            {chip.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Thread card content (shared between single + bulk) ──

function ThreadCardContent({
  thread,
  category,
  triage,
  topics,
  commitments: threadCommitments,
  sender,
}: {
  thread: DiracThread;
  category?: FounderCategory;
  triage?: TriageCategory;
  topics: TopicTag[];
  commitments: Commitment[];
  sender?: { name: string; email: string };
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-accent shrink-0">
          <User className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground truncate">
            {sender?.name ?? sender?.email ?? "Unknown"}
          </p>
          {sender?.email && sender.name && (
            <p className="text-[10px] text-muted-foreground/60 truncate">{sender.email}</p>
          )}
        </div>
      </div>

      <p className="text-[12px] text-foreground font-medium truncate mb-2 pl-7">
        {thread.subject}
      </p>

      {(category || triage || topics.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {category && (
            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", FOUNDER_CATEGORY_COLORS[category])}>
              {FOUNDER_CATEGORY_LABELS[category]}
            </span>
          )}
          {triage === "needs_reply" && (
            <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
              Needs reply
            </span>
          )}
          {triage === "waiting_on" && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Waiting on
            </span>
          )}
          {topics.map((tag) => (
            <span
              key={tag}
              className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium leading-none", TOPIC_TAG_COLORS[tag] ?? "text-muted-foreground bg-muted")}
            >
              {TOPIC_TAG_LABELS[tag] ?? tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>{thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""}</span>
        <span>&middot;</span>
        <span>{formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}</span>
      </div>

      {threadCommitments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-1">
            {threadCommitments.length} commitment{threadCommitments.length !== 1 ? "s" : ""}
          </p>
          {threadCommitments.slice(0, 2).map((c) => (
            <p key={c.id} className={cn("text-[10px] truncate", c.isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
              {c.owner === "me" ? "You" : "They"}: {c.description}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
