"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Inbox,
  Activity,
  Settings,
  Sparkles,
  PenSquare,
  Star,
  StarOff,
  Archive,
  Trash2,
  Mail,
  MailOpen,
  MailX,
  AlertTriangle,
  Search,
  MessageSquare,
  Moon,
  Sun,
  RefreshCw,
  CornerDownLeft,
  CheckSquare,
  XSquare,
  Clock,
  Keyboard,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { useAppState } from "@/lib/dirac/store";
import { cn } from "@/lib/dirac/utils";

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const {
    threads,
    selectedThreadId,
    setSelectedThreadId,
    inboxFilter,
    setInboxFilter,
    aiSidebarOpen,
    setAiSidebarOpen,
    setComposeOpen,
    setComposeMinimized,
    toggleStarred,
    toggleUrgent,
    markThreadRead,
    markThreadUnread,
    archiveThread,
    trashThread,
    refreshThreads,
    setPendingAiQuery,
    selectAll,
    clearSelection,
    selectedThreadIds,
  } = useAppState();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "/" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "k" && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const run = useCallback((fn: () => void) => {
    fn();
    setOpen(false);
  }, []);

  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const isInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");

  const q = query.toLowerCase().trim();

  const matchedThreads = useMemo(() => {
    if (!q) return threads.slice(0, 5);
    return threads
      .filter(
        (t) =>
          t.subject.toLowerCase().includes(q) ||
          t.snippet.toLowerCase().includes(q) ||
          t.participants.some(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.email.toLowerCase().includes(q),
          ),
      )
      .slice(0, 6);
  }, [threads, q]);

  // ─── Static commands ───────────────────────────────────
  type Cmd = {
    id: string;
    label: string;
    icon: typeof Inbox;
    iconClass?: string;
    shortcut?: string;
    action: () => void;
    keywords: string;
    show?: boolean;
  };

  const commands: Cmd[] = useMemo(() => {
    const cmds: Cmd[] = [
      {
        id: "go-inbox",
        label: "Go to Inbox",
        icon: Inbox,
        shortcut: "G I",
        action: () => router.push("/inbox"),
        keywords: "inbox go navigate",
      },
      {
        id: "go-activity",
        label: "Go to Activity",
        icon: Activity,
        shortcut: "G A",
        action: () => router.push("/activity"),
        keywords: "activity go navigate",
      },
      {
        id: "go-settings",
        label: "Go to Settings",
        icon: Settings,
        shortcut: "G S",
        action: () => router.push("/settings"),
        keywords: "settings go navigate preferences",
      },
      {
        id: "compose",
        label: "Compose new email",
        icon: PenSquare,
        shortcut: "C",
        action: () => {
          setComposeOpen(true);
          setComposeMinimized(false);
        },
        keywords: "compose write new email send",
      },
      {
        id: "toggle-ai",
        label: `${aiSidebarOpen ? "Close" : "Open"} AI sidebar`,
        icon: Sparkles,
        iconClass: "text-primary",
        shortcut: "⌘L",
        action: () => setAiSidebarOpen(!aiSidebarOpen),
        keywords: "ai sidebar assistant",
      },
      {
        id: "refresh",
        label: "Refresh inbox",
        icon: RefreshCw,
        action: () => refreshThreads(),
        keywords: "refresh sync reload",
      },
      {
        id: "theme",
        label: `Switch to ${theme === "dark" ? "light" : "dark"} mode`,
        icon: theme === "dark" ? Sun : Moon,
        iconClass: theme === "dark" ? "text-yellow-500" : "",
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
        keywords: "theme dark light mode toggle",
      },
    ];

    if (isInbox) {
      cmds.push(
        {
          id: "filter-all",
          label: "Show all emails",
          icon: Inbox,
          action: () => setInboxFilter("all"),
          keywords: "filter all show",
          show: inboxFilter !== "all",
        },
        {
          id: "filter-unread",
          label: "Show unread only",
          icon: Mail,
          iconClass: "text-blue-500",
          action: () => setInboxFilter("unread"),
          keywords: "filter unread",
          show: inboxFilter !== "unread",
        },
        {
          id: "filter-starred",
          label: "Show starred only",
          icon: Star,
          iconClass: "text-yellow-500",
          action: () => setInboxFilter("starred"),
          keywords: "filter starred",
          show: inboxFilter !== "starred",
        },
        {
          id: "filter-urgent",
          label: "Show urgent only",
          icon: AlertTriangle,
          iconClass: "text-red-500",
          action: () => setInboxFilter("urgent"),
          keywords: "filter urgent",
          show: inboxFilter !== "urgent",
        },
        {
          id: "filter-waiting",
          label: "Show waiting on only",
          icon: Clock,
          iconClass: "text-orange-500",
          action: () => setInboxFilter("waiting_on"),
          keywords: "filter waiting on",
          show: inboxFilter !== "waiting_on",
        },
        {
          id: "select-all",
          label: "Select all threads",
          icon: CheckSquare,
          shortcut: "X",
          action: () => selectAll(threads.map((t) => t.id)),
          keywords: "select all bulk threads",
        },
        {
          id: "clear-selection",
          label: "Clear selection",
          icon: XSquare,
          action: () => clearSelection(),
          keywords: "clear deselect selection",
          show: selectedThreadIds.size > 0,
        },
        {
          id: "focus-search",
          label: "Focus search",
          icon: Search,
          shortcut: "/",
          action: () => window.dispatchEvent(new CustomEvent("dirac:focus-search")),
          keywords: "search focus find",
        },
        {
          id: "shortcuts-help",
          label: "Show keyboard shortcuts",
          icon: Keyboard,
          shortcut: "?",
          action: () => window.dispatchEvent(new CustomEvent("dirac:shortcuts-help")),
          keywords: "shortcuts keyboard help",
        },
      );
    }

    if (selectedThread && isInbox) {
      cmds.push(
        {
          id: "star-thread",
          label: `${selectedThread.isStarred ? "Unstar" : "Star"} thread`,
          icon: selectedThread.isStarred ? StarOff : Star,
          iconClass: selectedThread.isStarred ? "" : "text-yellow-500",
          shortcut: "S",
          action: () => toggleStarred(selectedThread.id),
          keywords: "star unstar thread",
        },
        {
          id: "read-thread",
          label: `Mark ${selectedThread.isUnread ? "read" : "unread"}`,
          icon: selectedThread.isUnread ? MailOpen : MailX,
          shortcut: "U",
          action: () => {
            if (selectedThread.isUnread) markThreadRead(selectedThread.id);
            else markThreadUnread(selectedThread.id);
          },
          keywords: "read unread mark thread",
        },
        {
          id: "urgent-thread",
          label: `${selectedThread.isUrgent ? "Remove urgent" : "Mark urgent"}`,
          icon: AlertTriangle,
          iconClass: selectedThread.isUrgent ? "" : "text-red-500",
          action: () => toggleUrgent(selectedThread.id),
          keywords: "urgent mark remove thread",
        },
        {
          id: "archive-thread",
          label: "Archive thread",
          icon: Archive,
          shortcut: "E",
          action: () => {
            archiveThread(selectedThread.id);
            setSelectedThreadId(null);
          },
          keywords: "archive thread",
        },
        {
          id: "trash-thread",
          label: "Delete thread",
          icon: Trash2,
          iconClass: "text-red-500",
          shortcut: "#",
          action: () => {
            trashThread(selectedThread.id);
            setSelectedThreadId(null);
          },
          keywords: "delete trash remove thread",
        },
      );
    }

    return cmds.filter((c) => c.show !== false);
  }, [
    aiSidebarOpen,
    theme,
    isInbox,
    inboxFilter,
    selectedThread,
    router,
    setComposeOpen,
    setComposeMinimized,
    setAiSidebarOpen,
    refreshThreads,
    setTheme,
    setInboxFilter,
    toggleStarred,
    markThreadRead,
    markThreadUnread,
    toggleUrgent,
    archiveThread,
    trashThread,
    setSelectedThreadId,
    selectAll,
    clearSelection,
    selectedThreadIds,
  ]);

  const filteredCommands = useMemo(() => {
    if (!q) return commands.slice(0, 6);
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.toLowerCase().includes(q),
    );
  }, [commands, q]);

  // ─── Hand off to AI sidebar ────────────────────────────
  const handleAskAi = useCallback(() => {
    if (!query.trim()) return;
    setPendingAiQuery(query.trim());
    setAiSidebarOpen(true);
    setOpen(false);
  }, [query, setPendingAiQuery, setAiSidebarOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && e.metaKey) {
        e.preventDefault();
        handleAskAi();
      }
    },
    [handleAskAi],
  );

  if (!mounted) return null;

  return (
    <div onKeyDown={handleKeyDown}>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        showCloseButton={false}
        className="max-w-xl"
      >
        <CommandInput
          ref={inputRef}
          placeholder="Search, run commands, or ⌘↵ to ask AI..."
          value={query}
          onValueChange={setQuery}
        />

        <CommandList className="max-h-[360px]">
          <CommandEmpty>
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Search className="mb-2 h-6 w-6 opacity-30" />
              <p className="text-sm">
                No results for &quot;{query}&quot;
              </p>
              <button
                onClick={handleAskAi}
                className="mt-3 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Sparkles className="h-3 w-3" />
                Ask AI instead
              </button>
            </div>
          </CommandEmpty>

          {/* Commands */}
          {filteredCommands.length > 0 && (
            <CommandGroup
              heading={
                selectedThread && isInbox && q === ""
                  ? "Actions"
                  : "Commands"
              }
            >
              {filteredCommands.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords}`}
                    onSelect={() => run(() => cmd.action())}
                  >
                    <Icon
                      className={cn("text-muted-foreground", cmd.iconClass)}
                    />
                    <span>{cmd.label}</span>
                    {cmd.shortcut && (
                      <span className="ml-auto text-xs tracking-widest text-muted-foreground">
                        {cmd.shortcut}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {/* Emails */}
          {matchedThreads.length > 0 && (
            <>
              {filteredCommands.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Emails">
                {matchedThreads.map((t) => {
                  const sender = t.participants[0];
                  const platformIcon =
                    t.platform === "DISCORD" ? (
                      <MessageSquare className="h-3.5 w-3.5 text-indigo-500" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    );

                  return (
                    <CommandItem
                      key={t.id}
                      value={`email ${t.subject} ${t.participants.map((p) => `${p.name} ${p.email}`).join(" ")} ${t.snippet}`}
                      onSelect={() =>
                        run(() => {
                          router.push("/inbox");
                          setSelectedThreadId(t.id);
                        })
                      }
                      className="gap-3"
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                          t.isUnread ? "bg-blue-500/10" : "bg-muted",
                        )}
                      >
                        {platformIcon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p
                            className={cn(
                              "truncate text-sm",
                              t.isUnread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {t.subject}
                          </p>
                          {t.isStarred && (
                            <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {sender?.name ?? sender?.email ?? "Unknown"} &middot;{" "}
                          {t.snippet.slice(0, 50)}
                          {t.snippet.length > 50 ? "..." : ""}
                        </p>
                      </div>
                      {t.isUnread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">
                ⌘↵
              </kbd>{" "}
              Ask AI
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px] font-medium">
              esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </CommandDialog>
    </div>
  );
}
