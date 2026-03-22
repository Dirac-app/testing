"use client";

/**
 * Minimal toast notification system.
 * No external dependencies — uses React state + CSS transitions.
 * Usage: import { useToast } from "@/components/ui/toast"
 *        const { toast } = useToast();
 *        toast({ title: "Done", description: "Message sent", variant: "success" });
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/dirac/utils";

// ─── Types ───────────────────────────────────────────────

export type ToastVariant = "default" | "success" | "error" | "info";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number; // ms, default 4000
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

// ─── Context ─────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const duration = item.duration ?? 4000;
      setToasts((prev) => [...prev, { ...item, id }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ─── Viewport (fixed overlay) ────────────────────────────

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ─── Individual toast card ────────────────────────────────

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next tick
    const id = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(id);
  }, []);

  const variantStyles: Record<ToastVariant, string> = {
    default: "bg-card border-border text-foreground",
    success: "bg-card border-green-500/30 text-foreground",
    error: "bg-card border-red-500/30 text-foreground",
    info: "bg-card border-blue-500/30 text-foreground",
  };

  const IconMap: Record<ToastVariant, typeof CheckCircle2 | null> = {
    default: null,
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  };

  const iconColors: Record<ToastVariant, string> = {
    default: "",
    success: "text-green-500",
    error: "text-red-500",
    info: "text-blue-500",
  };

  const variant = toast.variant ?? "default";
  const Icon = IconMap[variant];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300",
        variantStyles[variant],
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
      role="alert"
    >
      {Icon && (
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColors[variant])} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
