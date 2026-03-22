/**
 * Shared AI response parser.
 * Extracted from ai-sidebar.tsx so it can be reused in any component
 * that receives streaming AI content with fenced code blocks.
 *
 * Supported fence types:
 *   ```mcq     — multiple-choice question JSON
 *   ```draft   — plain text email draft
 *   ```compose — compose-window prefill JSON { to, subject, body }
 *   ```actions — array of thread action objects
 *   ```results — array of search/filter result objects
 *
 * Any text between fences is returned as a "text" segment.
 */

// ─── Types (re-exported so callers don't need to re-declare) ──

export interface McqQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface ComposeData {
  to: string;
  subject: string;
  body: string;
}

export interface ActionItem {
  threadId: string;
  action:
    | "star"
    | "unstar"
    | "mark_read"
    | "mark_unread"
    | "mark_urgent"
    | "remove_urgent"
    | "archive"
    | "trash";
  subject: string;
}

export interface ResultItem {
  threadId: string;
  subject: string;
  from: string;
  reason: string;
}

export interface ParsedSegment {
  type: "text" | "mcq" | "draft" | "compose" | "actions" | "results";
  content: string;
  mcq?: McqQuestion[];
  compose?: ComposeData;
  actions?: ActionItem[];
  results?: ResultItem[];
}

// ─── Parser ──────────────────────────────────────────────

export function parseAiContent(raw: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const fenceRegex = /```(mcq|draft|compose|actions|results)\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(raw)) !== null) {
    // Capture any plain text before this fence
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index).trim();
      if (text) segments.push({ type: "text", content: text });
    }

    const fenceType = match[1] as "mcq" | "draft" | "compose" | "actions" | "results";
    const fenceBody = match[2].trim();

    switch (fenceType) {
      case "mcq": {
        try {
          const parsed: McqQuestion[] = JSON.parse(fenceBody);
          segments.push({ type: "mcq", content: fenceBody, mcq: parsed });
        } catch {
          segments.push({ type: "text", content: fenceBody });
        }
        break;
      }
      case "compose": {
        try {
          const parsed: ComposeData = JSON.parse(fenceBody);
          segments.push({ type: "compose", content: fenceBody, compose: parsed });
        } catch {
          segments.push({ type: "text", content: fenceBody });
        }
        break;
      }
      case "actions": {
        try {
          const parsed: ActionItem[] = JSON.parse(fenceBody);
          segments.push({ type: "actions", content: fenceBody, actions: parsed });
        } catch {
          segments.push({ type: "text", content: fenceBody });
        }
        break;
      }
      case "results": {
        try {
          const parsed: ResultItem[] = JSON.parse(fenceBody);
          segments.push({ type: "results", content: fenceBody, results: parsed });
        } catch {
          segments.push({ type: "text", content: fenceBody });
        }
        break;
      }
      default: {
        // "draft" — plain text, no JSON parsing needed
        segments.push({ type: "draft", content: fenceBody });
        break;
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Capture any trailing plain text
  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex).trim();
    if (text) segments.push({ type: "text", content: text });
  }

  // Fall back to a single text segment if nothing was parsed
  if (segments.length === 0 && raw.trim()) {
    segments.push({ type: "text", content: raw.trim() });
  }

  return segments;
}
