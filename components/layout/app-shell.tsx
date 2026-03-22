"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AppNav } from "./app-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "./app-provider";
import { SessionProvider } from "./session-provider";
import { ComposePanel } from "@/components/compose/compose-panel";
import { SpotlightSearch } from "@/components/command-palette/spotlight-search";
import { KeyboardShortcutsProvider } from "./keyboard-shortcuts-provider";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts/keyboard-shortcuts-help";
import { ToastProvider } from "@/components/ui/toast";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <ToastProvider>
      <SessionProvider>
        <AppProvider>
          <KeyboardShortcutsProvider />
          <TooltipProvider delayDuration={0}>
            <div className="dirac-bg flex h-screen w-screen items-stretch gap-3 overflow-hidden p-6">
              <AppNav />
              <main className="flex flex-1 items-stretch gap-3 overflow-hidden">
                {children}
              </main>
            </div>
          </TooltipProvider>
          <SpotlightSearch />
          <ComposePanel />
          <KeyboardShortcutsHelp />
        </AppProvider>
      </SessionProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
