"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, X, RotateCcw, Loader2 } from "lucide-react";

/**
 * Minimal accessible toast system matching the existing glass-card theme.
 * Event-based so any client component can raise one without prop drilling.
 *
 *   showToast({ variant: "success", message: "..." })
 *   showToast({ variant: "error", message: "...", actionLabel: "Retry", onAction })
 */

export type ToastVariant = "success" | "error" | "warning";

export interface ToastOptions {
  variant: ToastVariant;
  message: string;
  /** Optional inline action, e.g. Retry. Kept unobtrusive and theme-matched. */
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
  leaving?: boolean;
}

const listeners = new Set<(t: ToastItem) => void>();
let nextId = 1;

export function showToast(options: ToastOptions) {
  const item: ToastItem = { ...options, id: nextId++ };
  listeners.forEach((listener) => listener(item));
}

export function dismissToast(id: number) {
  showToast({ variant: "warning", message: `__dismiss__:${id}` });
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-status-success/40 text-status-success",
  error: "border-status-danger/40 text-status-danger",
  warning: "border-brand-accent/40 text-brand-accent",
};

const VARIANT_ICON = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

/** Screen-reader live region mirrors the latest toast announcement. */
export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const listener = (item: ToastItem) => {
      if (item.message.startsWith("__dismiss__:")) {
        const id = Number(item.message.split(":")[1]);
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 220);
        return;
      }
      setToasts((prev) => [...prev.slice(-2), item]);
      setAnnouncement(item.message);
      if (item.variant !== "error" && !item.onAction) {
        const ttl = item.durationMs ?? 3500;
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== item.id));
        }, ttl);
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {announcement}
      </div>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none w-[calc(100vw-2rem)] max-w-sm">
        {toasts.map((toast) => {
          const Icon = VARIANT_ICON[toast.variant];
          return (
            <div
              key={toast.id}
              role="alert"
              aria-live={toast.variant === "error" ? "assertive" : undefined}
              className={`glass-card pointer-events-auto flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium shadow-lg transition-all duration-200 ${
                toast.variant === "error" ? "bg-status-danger/10" : "bg-surface-elevated/95"
              } ${VARIANT_STYLES[toast.variant]} ${toast.leaving ? "opacity-0 translate-y-2" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" aria-hidden />
              <span className="text-content-primary flex-1 min-w-0 break-words">
                {toast.message}
              </span>
              {toast.onAction && toast.actionLabel && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id));
                  }}
                  className="flex items-center gap-1 flex-shrink-0 rounded-lg border border-outline-subtle bg-surface-page px-2.5 py-1 text-[11px] font-bold text-brand-accent hover:bg-brand-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary transition"
                >
                  {toast.variant === "error" && (
                    <RotateCcw className="w-3 h-3" aria-hidden />
                  )}
                  {toast.actionLabel}
                </button>
              )}
              {toast.variant !== "success" && !toast.onAction && (
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() =>
                    setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                  }
                  className="text-content-muted hover:text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function ToastSpinner() {
  return <Loader2 className="w-4 h-4 animate-spin" aria-hidden />;
}
