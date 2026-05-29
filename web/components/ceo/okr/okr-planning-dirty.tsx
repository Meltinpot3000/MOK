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
import { saveOkrPlanningPanelAction } from "@/app/(ceo)/okr-workspace/actions";

type OkrPlanningDirtyContextValue = {
  markDirty: (formId?: string) => void;
  clearDirty: () => void;
  requestNavigation: (proceed: () => void) => void;
  isFormDirty: (formId: string) => boolean;
};

const OkrPlanningDirtyContext = createContext<OkrPlanningDirtyContextValue | null>(null);

export function useOkrPlanningDirty(): OkrPlanningDirtyContextValue {
  const ctx = useContext(OkrPlanningDirtyContext);
  if (!ctx) {
    return {
      markDirty: () => {},
      clearDirty: () => {},
      requestNavigation: (proceed) => proceed(),
      isFormDirty: () => false,
    };
  }
  return ctx;
}

function isInternalAppHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

function isLeavingOkrPlanning(href: string): boolean {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  return path !== "/okr/planning";
}

export function OkrPlanningDirtyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const dirtyFormIdsRef = useRef(new Set<string>());
  const pendingNavRef = useRef<(() => void) | null>(null);

  const markDirty = useCallback((formId?: string) => {
    setDirty(true);
    if (formId) dirtyFormIdsRef.current.add(formId);
  }, []);

  const clearDirty = useCallback(() => {
    setDirty(false);
    dirtyFormIdsRef.current.clear();
  }, []);

  const isFormDirty = useCallback((formId: string) => dirtyFormIdsRef.current.has(formId), []);

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
      if (!href || !isInternalAppHref(href) || !isLeavingOkrPlanning(href)) return;
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

  const saveDirtyForms = useCallback(async (): Promise<boolean> => {
    const ids = [...dirtyFormIdsRef.current];
    const forms =
      ids.length > 0
        ? ids
            .map((id) => document.getElementById(id))
            .filter((el): el is HTMLFormElement => el instanceof HTMLFormElement)
        : [...document.querySelectorAll<HTMLFormElement>('form[id^="okr-planning-form-"]')];

    if (forms.length === 0) {
      clearDirty();
      return true;
    }

    for (const form of forms) {
      const fd = new FormData(form);
      fd.set("run_contribution_assessment", "1");
      const r = await saveOkrPlanningPanelAction(fd);
      if (r && "error" in r && r.error) {
        window.alert(r.error);
        return false;
      }
    }
    clearDirty();
    await router.refresh();
    return true;
  }, [clearDirty, router]);

  const ctxValue: OkrPlanningDirtyContextValue = {
    markDirty,
    clearDirty,
    requestNavigation,
    isFormDirty,
  };

  return (
    <OkrPlanningDirtyContext.Provider value={ctxValue}>
      {children}
      {leaveOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Schließen"
            className="absolute inset-0 bg-zinc-900/50"
            disabled={savePending}
            onClick={() => {
              pendingNavRef.current = null;
              setLeaveOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-lg"
          >
            <h2 className="text-base font-semibold text-zinc-900">Ungespeicherte Änderungen</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Es gibt Änderungen in der OKR-Planung, die noch nicht gespeichert wurden. Möchten Sie
              alles speichern oder verwerfen?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={savePending}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 disabled:opacity-50"
                onClick={() => {
                  pendingNavRef.current = null;
                  setLeaveOpen(false);
                }}
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
                    const ok = await saveDirtyForms();
                    setSavePending(false);
                    if (ok) runPendingNav();
                  })();
                }}
              >
                {savePending ? "Speichern…" : "Alles speichern"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OkrPlanningDirtyContext.Provider>
  );
}
