"use client";

import { createContext, useContext } from "react";
import type {
  DiracThread,
  DiracMessage,
  InboxFilter,
  TriageCategory,
  FounderCategory,
  Commitment,
  SnoozeState,
  RelationshipContext,
  PatternSuggestion,
  TopicTag,
} from "./types";

export interface AiContextItem {
  id: string;
  label: string; // thread subject
}

export type ToneContext =
  | "cold_outreach"
  | "client_customer"
  | "internal_team"
  | "formal_professional"
  | "casual_personal"
  | "follow_ups";

export const TONE_CONTEXT_LABELS: Record<ToneContext, string> = {
  cold_outreach: "Cold outreach",
  client_customer: "Client / customer",
  internal_team: "Internal team",
  formal_professional: "Formal / professional",
  casual_personal: "Casual / personal",
  follow_ups: "Follow-ups & reminders",
};

export interface ConditionalTone {
  context: ToneContext;
  tone: string;
  formality: "formal" | "semi-formal" | "casual" | "very-casual";
  traits: string[];
  example_phrases: string[];
}

export interface ToneProfile {
  summary: string;
  formality: "formal" | "semi-formal" | "casual" | "very-casual";
  traits: string[];
  greeting_style: string;
  signoff_style: string;
  example_phrases: string[];
  conditional_tones?: ConditionalTone[];
}

export interface AppState {
  selectedThreadId: string | null;
  setSelectedThreadId: (id: string | null) => void;
  aiSidebarOpen: boolean;
  setAiSidebarOpen: (open: boolean) => void;
  inboxFilter: InboxFilter;
  setInboxFilter: (filter: InboxFilter) => void;
  threads: DiracThread[];
  threadsLoading: boolean;
  messages: DiracMessage[];
  messagesLoading: boolean;
  refreshThreads: () => void;
  // Compose panel
  composeOpen: boolean;
  setComposeOpen: (open: boolean) => void;
  composeMinimized: boolean;
  setComposeMinimized: (min: boolean) => void;
  // Tone profile
  toneProfile: ToneProfile | null;
  setToneProfile: (profile: ToneProfile | null) => void;
  // Thread actions
  toggleStarred: (threadId: string) => void;
  toggleUrgent: (threadId: string) => void;
  markThreadUnread: (threadId: string) => void;
  markThreadRead: (threadId: string) => void;
  archiveThread: (threadId: string) => void;
  trashThread: (threadId: string) => void;
  // AI context (shared between sidebar + thread view)
  aiContext: AiContextItem[];
  addToAiContext: (item: AiContextItem) => void;
  removeFromAiContext: (id: string) => void;
  toggleAiContext: (item: AiContextItem) => void;
  isInAiContext: (id: string) => boolean;
  // Triage
  triageMap: Record<string, TriageCategory>;
  triageLoading: boolean;
  runTriage: () => void;
  // AI query handoff (spotlight → sidebar)
  pendingAiQuery: string | null;
  setPendingAiQuery: (query: string | null) => void;
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // Density
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  // Bulk select
  selectedThreadIds: Set<string>;
  toggleBulkSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  // Unread count
  unreadCount: number;
  // Thread lifecycle (Direction A)
  snoozedThreads: SnoozeState[];
  snoozeThread: (threadId: string, snooze: Omit<SnoozeState, "threadId" | "snoozedAt">) => void;
  unsnoozeThread: (threadId: string) => void;
  doneThreads: Set<string>;
  markDone: (threadId: string) => void;
  unmarkDone: (threadId: string) => void;
  commitments: Commitment[];
  setCommitments: (commitments: Commitment[]) => void;
  dismissCommitment: (id: string) => void;
  // Founder categories (Direction B)
  categoryMap: Record<string, FounderCategory>;
  categoryLoading: boolean;
  runCategorization: () => void;
  // Pattern suggestions (Direction B.3)
  patternSuggestions: PatternSuggestion[];
  dismissPattern: (id: string) => void;
  applyPattern: (id: string) => void;
  // Relationship context (Direction B.4)
  getRelationshipContext: (email: string) => RelationshipContext | null;
  // Topic tags (AI-generated from fixed set)
  topicMap: Record<string, TopicTag[]>;
  topicLoading: boolean;
  runTopicTagging: () => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}

// QoL additions to AppState
export interface QoLState {
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  // Density
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  // Bulk select
  selectedThreadIds: Set<string>;
  toggleBulkSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  // Unread count (derived, no setter needed)
  unreadCount: number;
}
