"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["J"], desc: "Next thread" },
      { keys: ["K"], desc: "Previous thread" },
      { keys: ["G", "I"], desc: "Go to Inbox" },
      { keys: ["G", "A"], desc: "Go to Activity" },
      { keys: ["G", "S"], desc: "Go to Settings" },
      { keys: ["Esc"], desc: "Deselect thread" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["C"], desc: "Compose new email" },
      { keys: ["R"], desc: "Open AI sidebar" },
      { keys: ["E"], desc: "Archive thread" },
      { keys: ["S"], desc: "Star / unstar" },
      { keys: ["U"], desc: "Toggle read / unread" },
      { keys: ["#"], desc: "Delete thread" },
      { keys: ["X"], desc: "Bulk-select thread" },
      { keys: ["F"], desc: "Cycle inbox filter" },
      { keys: ["/"], desc: "Focus search" },
    ],
  },
  {
    title: "AI",
    shortcuts: [
      { keys: ["⌘", "L"], desc: "Toggle AI sidebar" },
      { keys: ["R"], desc: "Open AI for selected thread" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-mono text-foreground leading-none">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("dirac:shortcuts-help", handler);
    return () => window.removeEventListener("dirac:shortcuts-help", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 pt-1">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.shortcuts.map(({ keys, desc }) => (
                  <div key={desc} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{desc}</span>
                    <div className="flex items-center gap-1">
                      {keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {i < keys.length - 1 && (
                            <span className="text-[10px] text-muted-foreground">then</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground/60 mt-2 border-t border-border pt-3">
          Press <Kbd>?</Kbd> anytime to open this panel
        </p>
      </DialogContent>
    </Dialog>
  );
}
