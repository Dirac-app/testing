// Dirac shared types (mirrors Prisma models for client use)

export type Platform = "GMAIL" | "OUTLOOK" | "DISCORD" | "INSTAGRAM" | "SLACK";

export type ThreadStatus = "INBOX" | "DONE" | "SNOOZED" | "ARCHIVED";

// ─── Founder-relevant categories (Direction B.1) ────────
export type FounderCategory =
  | "investor"
  | "customer"
  | "vendor"
  | "outreach"
  | "automated"
  | "personal";

export const FOUNDER_CATEGORY_LABELS: Record<FounderCategory, string> = {
  investor: "Investor",
  customer: "Customer",
  vendor: "Vendor",
  outreach: "Outreach",
  automated: "Automated",
  personal: "Personal",
};

export const FOUNDER_CATEGORY_COLORS: Record<FounderCategory, string> = {
  investor: "text-purple-600 bg-purple-500/10",
  customer: "text-emerald-600 bg-emerald-500/10",
  vendor: "text-blue-600 bg-blue-500/10",
  outreach: "text-amber-600 bg-amber-500/10",
  automated: "text-gray-500 bg-gray-500/10",
  personal: "text-pink-600 bg-pink-500/10",
};

// ─── Commitments (Direction A.3) ────────────────────────
export interface Commitment {
  id: string;
  threadId: string;
  description: string;
  owner: "me" | "them";
  dueDate?: string; // ISO date
  isOverdue: boolean;
  createdAt: string;
}

// ─── Snooze (Direction A.2) ─────────────────────────────
export type SnoozeMode = "time" | "reply" | "condition";

export interface SnoozeState {
  threadId: string;
  mode: SnoozeMode;
  until?: string; // ISO date for time-based
  condition?: string; // description for condition-based
  snoozedAt: string;
}

// ─── Relationship context (Direction B.4) ───────────────
export interface RelationshipContext {
  email: string;
  name: string;
  totalThreads: number;
  avgResponseTimeHours: number | null;
  theirAvgResponseTimeHours: number | null;
  toneUsed: string | null;
  recentSubjects: string[];
  lastContacted: string | null;
}

// ─── Pattern suggestions (Direction B.3) ────────────────
export interface PatternSuggestion {
  id: string;
  senderEmail: string;
  senderName: string;
  pattern: string; // "You archive 9/10 emails from this sender"
  suggestedAction: "archive" | "star" | "mark_read" | "mark_urgent";
  confidence: number; // 0-1
  dismissed: boolean;
}

export interface DiracThread {
  id: string;
  platform: Platform;
  subject: string;
  snippet: string;
  isUnread: boolean;
  isStarred: boolean;
  isUrgent: boolean;
  messageCount: number;
  lastMessageAt: string; // ISO date
  participants: { name: string; email: string; avatarUrl?: string }[];
  status: ThreadStatus;
  tags: string[];
  urgencyScore?: number;
  isPinned: boolean;
}

export interface DiracMessage {
  id: string;
  threadId: string;
  fromName: string;
  fromAddress: string;
  toAddresses: string[];
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  sentAt: string; // ISO date
}

export type TriageCategory = "needs_reply" | "waiting_on" | "fyi" | "automated";

export const TRIAGE_LABELS: Record<TriageCategory, string> = {
  needs_reply: "Needs reply",
  waiting_on: "Waiting on",
  fyi: "FYI",
  automated: "Automated",
};

export type InboxFilter =
  | "all"
  | "needs_reply"
  | "waiting_on"
  | "snoozed"
  | "done"
  | "unread"
  | "starred"
  | "urgent";

// ─── Topic tags (AI-generated from fixed set) ───────────
export type TopicTag =
  | "billing"
  | "security"
  | "onboarding"
  | "support"
  | "feedback"
  | "meeting"
  | "legal"
  | "hiring"
  | "fundraising"
  | "shipping"
  | "marketing"
  | "ci_cd"
  | "monitoring"
  | "access"
  | "announcement"
  | "intro"
  | "follow_up"
  | "personal";

export const TOPIC_TAG_LABELS: Record<TopicTag, string> = {
  billing: "billing",
  security: "security",
  onboarding: "onboarding",
  support: "support",
  feedback: "feedback",
  meeting: "meeting",
  legal: "legal",
  hiring: "hiring",
  fundraising: "fundraising",
  shipping: "shipping",
  marketing: "marketing",
  ci_cd: "CI/CD",
  monitoring: "monitoring",
  access: "access",
  announcement: "announcement",
  intro: "intro",
  follow_up: "follow-up",
  personal: "personal",
};

export const TOPIC_TAG_COLORS: Record<TopicTag, string> = {
  billing: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10",
  security: "text-red-700 dark:text-red-400 bg-red-500/10",
  onboarding: "text-sky-700 dark:text-sky-400 bg-sky-500/10",
  support: "text-orange-700 dark:text-orange-400 bg-orange-500/10",
  feedback: "text-violet-700 dark:text-violet-400 bg-violet-500/10",
  meeting: "text-blue-700 dark:text-blue-400 bg-blue-500/10",
  legal: "text-slate-700 dark:text-slate-400 bg-slate-500/10",
  hiring: "text-teal-700 dark:text-teal-400 bg-teal-500/10",
  fundraising: "text-purple-700 dark:text-purple-400 bg-purple-500/10",
  shipping: "text-amber-700 dark:text-amber-400 bg-amber-500/10",
  marketing: "text-pink-700 dark:text-pink-400 bg-pink-500/10",
  ci_cd: "text-cyan-700 dark:text-cyan-400 bg-cyan-500/10",
  monitoring: "text-rose-700 dark:text-rose-400 bg-rose-500/10",
  access: "text-indigo-700 dark:text-indigo-400 bg-indigo-500/10",
  announcement: "text-fuchsia-700 dark:text-fuchsia-400 bg-fuchsia-500/10",
  intro: "text-lime-700 dark:text-lime-400 bg-lime-500/10",
  follow_up: "text-yellow-700 dark:text-yellow-400 bg-yellow-500/10",
  personal: "text-gray-600 dark:text-gray-400 bg-gray-500/10",
};
