"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppState } from "@/lib/dirac/store";

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    threads,
    selectedThreadId,
    setSelectedThreadId,
    setAiSidebarOpen,
    aiSidebarOpen,
    setComposeOpen,
    setComposeMinimized,
    toggleStarred,
    markThreadRead,
    markThreadUnread,
    archiveThread,
    trashThread,
    inboxFilter,
    setInboxFilter,
    refreshThreads,
    toggleBulkSelect,
    setSearchQuery,
  } = useAppState();

  const FILTER_CYCLE: (typeof inboxFilter)[] = ["all", "unread", "urgent", "waiting_on", "starred"];

  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInbox = pathname === "/inbox" || pathname.startsWith("/inbox/");

  const filteredThreads = threads.filter((t) => {
    if (inboxFilter === "unread") return t.isUnread;
    if (inboxFilter === "starred") return t.isStarred;
    if (inboxFilter === "urgent") return t.isUrgent;
    return true;
  });

  const getSelectedIndex = useCallback(() => {
    if (!selectedThreadId) return -1;
    return filteredThreads.findIndex((t) => t.id === selectedThreadId);
  }, [selectedThreadId, filteredThreads]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      const key = e.key.toLowerCase();

      // "g" prefix for goto shortcuts
      if (gPending.current) {
        gPending.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);

        if (key === "i") {
          e.preventDefault();
          router.push("/inbox");
          return;
        }
        if (key === "a") {
          e.preventDefault();
          router.push("/activity");
          return;
        }
        if (key === "s") {
          e.preventDefault();
          router.push("/settings");
          return;
        }
        // Unrecognized second key — ignore
        return;
      }

      if (key === "g" && !e.metaKey && !e.ctrlKey) {
        gPending.current = true;
        gTimer.current = setTimeout(() => {
          gPending.current = false;
        }, 500);
        return;
      }

      // Cmd+L / Ctrl+L — toggle AI sidebar
      if (key === "l" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAiSidebarOpen(!aiSidebarOpen);
        return;
      }

      if (!isInbox) return;

      // j/k — navigate thread list
      if (key === "j" || key === "k") {
        e.preventDefault();
        const idx = getSelectedIndex();
        let next: number;
        if (key === "j") {
          next = idx < filteredThreads.length - 1 ? idx + 1 : idx;
        } else {
          next = idx > 0 ? idx - 1 : 0;
        }
        if (filteredThreads[next]) {
          setSelectedThreadId(filteredThreads[next].id);
        }
        return;
      }

      // o or Enter — open selected thread (same as selecting, it's already open)
      // Escape — deselect thread
      if (key === "escape") {
        e.preventDefault();
        setSelectedThreadId(null);
        return;
      }

      // Actions on selected thread
      if (!selectedThreadId) return;
      const thread = threads.find((t) => t.id === selectedThreadId);
      if (!thread) return;

      if (key === "s" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleStarred(thread.id);
        return;
      }

      if (key === "u" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (thread.isUnread) markThreadRead(thread.id);
        else markThreadUnread(thread.id);
        return;
      }

      if (key === "e" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        archiveThread(thread.id);
        setSelectedThreadId(null);
        return;
      }

      if (key === "#" || (key === "3" && e.shiftKey)) {
        e.preventDefault();
        trashThread(thread.id);
        setSelectedThreadId(null);
        return;
      }

      // r — open AI sidebar for reply
      if (key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setAiSidebarOpen(true);
        return;
      }

      // c — compose
      if (key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setComposeOpen(true);
        setComposeMinimized(false);
        return;
      }

      // ? — open keyboard shortcuts help
      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dirac:shortcuts-help"));
        return;
      }

      // x — bulk-select current thread
      if (key === "x" && !e.metaKey && !e.ctrlKey && selectedThreadId) {
        e.preventDefault();
        toggleBulkSelect(selectedThreadId);
        return;
      }

      // f — cycle through inbox filters
      if (key === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const idx = FILTER_CYCLE.indexOf(inboxFilter);
        const next = FILTER_CYCLE[(idx + 1) % FILTER_CYCLE.length];
        setInboxFilter(next);
        return;
      }

      // / — focus inline search
      if (key === "/" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dirac:focus-search"));
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    isInbox,
    selectedThreadId,
    threads,
    filteredThreads,
    aiSidebarOpen,
    getSelectedIndex,
    router,
    setSelectedThreadId,
    setAiSidebarOpen,
    setComposeOpen,
    setComposeMinimized,
    toggleStarred,
    markThreadRead,
    markThreadUnread,
    archiveThread,
    trashThread,
    refreshThreads,
    inboxFilter,
    setInboxFilter,
    toggleBulkSelect,
    setSearchQuery,
    FILTER_CYCLE,
  ]);
}
