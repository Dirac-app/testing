"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  X,
  Minus,
  Maximize2,
  Send,
  Loader2,
  Check,
  RotateCcw,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAppState } from "@/lib/dirac/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/dirac/utils";
import { useToast } from "@/components/ui/toast";

export function ComposePanel() {
  const {
    composeOpen,
    setComposeOpen,
    composeMinimized,
    setComposeMinimized,
  } = useAppState();
  const { data: session } = useSession();
  const { toast } = useToast();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [cc, setCc] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const DRAFT_KEY = "dirac_compose_draft";

  // On open, check for a saved draft
  useEffect(() => {
    if (!composeOpen) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.to || draft.subject || draft.body) setHasSavedDraft(true);
      }
    } catch {}
  }, [composeOpen]);

  // Auto-save on every field change (debounced 1s)
  useEffect(() => {
    if (!composeOpen) return;
    if (!to && !subject && !body) return; // don't save empty drafts
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ to, subject, body, cc }));
      } catch {}
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [to, subject, body, cc, composeOpen]);

  const recoverDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.to) setTo(draft.to);
        if (draft.subject) setSubject(draft.subject);
        if (draft.body) setBody(draft.body);
        if (draft.cc) { setCc(draft.cc); setShowCc(true); }
      }
    } catch {}
    setHasSavedDraft(false);
  }, []);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    setHasSavedDraft(false);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        if (detail.to) setTo(detail.to);
        if (detail.subject) setSubject(detail.subject);
        if (detail.body) setBody(detail.body.replace(/\\n/g, "\n"));
        setSent(false);
        setError(null);
      }
    };
    window.addEventListener("dirac:prefill-compose", handler);
    return () => window.removeEventListener("dirac:prefill-compose", handler);
  }, []);

  const canSend = to.trim() && body.trim() && !sending && !sent;

  const handleClose = useCallback(() => {
    clearDraft();
    setTo(""); setCc(""); setSubject(""); setBody(""); setShowCc(false);
    setComposeOpen(false);
    setComposeMinimized(false);
    setExpanded(false);
  }, [setComposeOpen, setComposeMinimized, clearDraft]);

  const handleMinimize = useCallback(() => {
    setComposeMinimized(!composeMinimized);
  }, [composeMinimized, setComposeMinimized]);

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);

    try {
      let res: Response;
      if (session?.gmailConnected) {
        res = await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: undefined,
            to: to.trim(),
            subject: subject.trim(),
            body: body.trim(),
          }),
        });
      } else {
        res = await fetch("/api/outlook/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: to.trim(),
            subject: subject.trim(),
            body: body.trim(),
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send");
      }

      setSent(true);
      clearDraft();
      toast({ title: "Message sent", variant: "success" });
      setTimeout(() => {
        setTo("");
        setCc("");
        setSubject("");
        setBody("");
        setShowCc(false);
        setSent(false);
        handleClose();
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      setError(msg);
      toast({ title: "Failed to send", description: msg, variant: "error" });
    } finally {
      setSending(false);
    }
  };

  if (!composeOpen) return null;

  // Minimized bar
  if (composeMinimized) {
    return (
      <div className="fixed bottom-0 right-6 z-50 w-72 rounded-t-lg border border-b-0 border-border bg-card shadow-lg">
        <button
          onClick={handleMinimize}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left"
        >
          <span className="truncate text-sm font-medium text-foreground">
            {subject.trim() || "New message"}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
            />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col rounded-t-lg border border-b-0 border-border bg-card shadow-2xl transition-all duration-200",
        expanded
          ? "bottom-0 right-6 h-[80vh] w-[640px]"
          : "bottom-0 right-6 h-[480px] w-[480px]",
      )}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between rounded-t-lg bg-muted/50 px-4 py-2">
        <span className="text-sm font-medium text-foreground">
          New message
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Draft recovery banner */}
      {hasSavedDraft && !to && !subject && !body && (
        <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-1.5 dark:border-amber-900 dark:bg-amber-950">
          <p className="text-xs text-amber-700 dark:text-amber-400">You have an unsaved draft</p>
          <div className="flex items-center gap-2">
            <button onClick={recoverDraft} className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 dark:text-amber-400">
              <RotateCcw className="h-3 w-3" /> Recover
            </button>
            <button onClick={clearDraft} className="text-xs text-amber-500 hover:text-amber-700 dark:text-amber-600">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-1.5 dark:border-red-900 dark:bg-red-950">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Form fields */}
      <div className="flex flex-col gap-0 border-b border-border">
        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="w-8 text-xs text-muted-foreground">To</span>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 h-8"
          />
          {!showCc && (
            <button
              onClick={() => setShowCc(true)}
              className="text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              Cc
            </button>
          )}
        </div>

        {showCc && (
          <>
            <Separator />
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span className="w-8 text-xs text-muted-foreground">Cc</span>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="cc@example.com"
                className="flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 h-8"
              />
            </div>
          </>
        )}

        <Separator />

        <div className="flex items-center gap-2 px-4 py-1.5">
          <span className="w-8 text-xs text-muted-foreground">Subj</span>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 h-8"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          className="h-full w-full resize-none rounded-none border-0 px-4 py-3 text-sm shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <Button
          size="sm"
          className="gap-1.5 px-4"
          onClick={handleSend}
          disabled={!canSend}
        >
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : sent ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {sending ? "Sending..." : sent ? "Sent!" : "Send"}
        </Button>

        <button
          onClick={handleClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
}
