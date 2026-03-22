"use client";

import { useKeyboardShortcuts } from "@/components/keyboard-shortcuts/use-keyboard-shortcuts";

export function KeyboardShortcutsProvider() {
  useKeyboardShortcuts();
  return null;
}
