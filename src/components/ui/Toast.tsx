/* eslint-disable react-refresh/only-export-components --
 * The toast store/helper and the Toaster component are intentionally
 * co-located: every consumer imports `toast()` and the component renders the
 * same store. Only affects fast-refresh granularity. */
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastKind = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

const AUTO_DISMISS_MS = 6000;
let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative helper so services/stores can toast without hooks. */
export function toast(kind: ToastKind, message: string): void {
  useToastStore.getState().push(kind, message);
}

const ICONS: Record<ToastKind, typeof Info> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

/** Fixed-position toast stack; mount once in the app shell. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={`toast ${t.kind}`} data-testid="toast">
            <Icon size={16} aria-hidden />
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Cerrar notificación"
              onClick={() => dismiss(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
