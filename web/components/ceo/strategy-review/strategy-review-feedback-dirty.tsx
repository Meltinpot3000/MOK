"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type StrategyReviewFeedbackDirtyContextValue = {
  markDirty: () => void;
  clearDirty: () => void;
  isDirty: boolean;
  registerSaveHandler: (fn: (() => Promise<boolean>) | null) => void;
  /** Ausgelöstes Speichern (Fly-in / Leave-Dialog). */
  runSave: () => Promise<boolean>;
  requestNavigation: (proceed: () => void) => void;
};

const StrategyReviewFeedbackDirtyContext =
  createContext<StrategyReviewFeedbackDirtyContextValue | null>(null);

export function useStrategyReviewFeedbackDirty(): StrategyReviewFeedbackDirtyContextValue {
  const ctx = useContext(StrategyReviewFeedbackDirtyContext);
  if (!ctx) {
    return {
      markDirty: () => {},
      clearDirty: () => {},
      isDirty: false,
      registerSaveHandler: () => {},
      runSave: async () => true,
      requestNavigation: (proceed) => proceed(),
    };
  }
  return ctx;
}

function isInternalAppHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function isLeavingStrategyReview(href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  return path !== "/reviews/strategy-review" && path !== "/okr/strategy-review";
}

export function StrategyReviewFeedbackDirtyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);
  const saveHandlerRef = useRef<(() => Promise<boolean>) | null>(null);

  const markDirty = useCallback(() => setDirty(true), []);
  const clearDirty = useCallback(() => setDirty(false), []);

  const registerSaveHandler = useCallback((fn: (() => Promise<boolean>) | null) => {
    saveHandlerRef.current = fn;
  }, []);

  const runSave = useCallback(async () => {
    const save = saveHandlerRef.current;
    if (!save) return true;
    return save();
  }, []);

  const requestNavigation = useCallback(
    (proceed: () => void) => {
      if (!dirty) {
        proceed();
        return;
      }
      pendingNavRef.current = proceed;
      setLeaveOpen(true);
    },
    [dirty]
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirty) return;
      const anchor = (e.target as Element | null)?.closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !isInternalAppHref(href) || !isLeavingStrategyReview(href)) return;
      if (anchor.getAttribute("target") === "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      requestNavigation(() => router.push(href));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, requestNavigation, router]);

  const runPendingNav = useCallback(() => {
    const fn = pendingNavRef.current;
    pendingNavRef.current = null;
    setLeaveOpen(false);
    fn?.();
  }, []);

  const closeLeaveDialog = useCallback(() => {
    pendingNavRef.current = null;
    setLeaveOpen(false);
  }, []);

  const ctxValue: StrategyReviewFeedbackDirtyContextValue = {
    markDirty,
    clearDirty,
    isDirty: dirty,
    registerSaveHandler,
    runSave,
    requestNavigation,
  };

  return (
    <StrategyReviewFeedbackDirtyContext.Provider value={ctxValue}>
      {children}
      {leaveOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Schließen"
            className="absolute inset-0 bg-zinc-900/50"
            disabled={savePending}
            onClick={closeLeaveDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sr-feedback-leave-title"
            className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
          >
            <h2 id="sr-feedback-leave-title" className="text-base font-semibold text-zinc-900">
              Ungespeicherte Änderungen
            </h2>
            <p className="mt-2 text-sm text-zinc-600">
              Es gibt Feedback-Bewertungen, die noch nicht gespeichert wurden. Möchten Sie speichern
              oder verwerfen?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={savePending}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
                onClick={closeLeaveDialog}
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={savePending}
                className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 disabled:opacity-50"
                onClick={() => {
                  clearDirty();
                  runPendingNav();
                }}
              >
                Verwerfen
              </button>
              <button
                type="button"
                disabled={savePending}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                onClick={() => {
                  setSavePending(true);
                  void (async () => {
                    const ok = await runSave();
                    setSavePending(false);
                    if (ok) {
                      clearDirty();
                      runPendingNav();
                    }
                  })();
                }}
              >
                {savePending ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StrategyReviewFeedbackDirtyContext.Provider>
  );
}
