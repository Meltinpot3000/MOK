"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  COVERAGE_LEVEL_META,
  COVERAGE_LEVEL_ORDER,
  type ContributionLevel,
  normalizeContributionLevel,
} from "@/lib/strategy-cycle/coverage-level";

export function CoverageStrengthPillButton({
  entityKey,
  entityValue,
  extraFields,
  isLinked,
  contributionLevel,
  linkAction,
  unlinkAction,
  children,
  title,
  canWrite,
  linkedClassName,
  unlinkedClassName,
  /** Kein × neben der Pill; Abwählen nur im Emoji-Picker (z. B. Matrix-Zellen). */
  unlinkInPickerOnly = false,
  /** Picker per Portal unterhalb des Buttons (nicht von overflow-x abgeschnitten). */
  detachPicker = false,
  /** Volle Breite der Zelle (Matrix). */
  fullWidth = false,
  /** Kein Oeffnen des Link-Pickers (z. B. Objective nicht active/at_risk); Abwahl bleibt moeglich. */
  linkSelectionDisabled = false,
}: {
  entityKey: string;
  entityValue: string;
  extraFields: Record<string, string>;
  isLinked: boolean;
  contributionLevel: ContributionLevel | null;
  linkAction: (fd: FormData) => Promise<void>;
  unlinkAction: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
  title?: string;
  canWrite: boolean;
  linkedClassName: string;
  unlinkedClassName: string;
  unlinkInPickerOnly?: boolean;
  detachPicker?: boolean;
  fullWidth?: boolean;
  linkSelectionDisabled?: boolean;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const pillBtnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fixedPos, setFixedPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [isPending, setIsPending] = useState(false);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<{
    linked: boolean;
    level: ContributionLevel | null;
  } | null>(null);

  const serverLinked = isLinked;
  const serverLevel = isLinked ? normalizeContributionLevel(contributionLevel ?? "medium") : null;
  const displayLinked = optimistic ? optimistic.linked : serverLinked;
  const displayLevel = optimistic?.linked ? optimistic.level : serverLevel;

  useEffect(() => {
    if (!optimistic) return;
    if (optimistic.linked === serverLinked) {
      if (!serverLinked || optimistic.level === serverLevel) {
        setOptimistic(null);
      }
    }
  }, [optimistic, serverLinked, serverLevel]);

  const updatePickerPos = () => {
    const el = pillBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setFixedPos({ top: r.bottom + 4, left: r.left });
  };

  useLayoutEffect(() => {
    if (!pickerOpen || !detachPicker) return;
    updatePickerPos();
    const onScroll = () => updatePickerPos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [pickerOpen, detachPicker]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      const root = rootRef.current;
      const picker = pickerRef.current;
      if (detachPicker) {
        if ((root && root.contains(t)) || (picker && picker.contains(t))) return;
        setPickerOpen(false);
        return;
      }
      if (root && !root.contains(t)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen, detachPicker]);

  const unlinkOnlyMode = linkSelectionDisabled && displayLinked && unlinkInPickerOnly;

  const runLink = async (level: ContributionLevel) => {
    if (!canWrite || isPending || linkSelectionDisabled) return;
    const fd = new FormData();
    fd.set(entityKey, entityValue);
    fd.set("contribution_level", level);
    fd.set("_noRedirect", "1");
    for (const [k, v] of Object.entries(extraFields)) fd.set(k, v);
    setOptimistic({ linked: true, level });
    setPickerOpen(false);
    setIsPending(true);
    try {
      await linkAction(fd);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const executeUnlink = async () => {
    if (!canWrite || isPending) return;
    const fd = new FormData();
    fd.set(entityKey, entityValue);
    fd.set("_noRedirect", "1");
    for (const [k, v] of Object.entries(extraFields)) fd.set(k, v);
    setOptimistic({ linked: false, level: null });
    setPickerOpen(false);
    setIsPending(true);
    try {
      await unlinkAction(fd);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const requestUnlink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUnlinkConfirmOpen(true);
  };

  const openPicker = () => {
    if (!canWrite || isPending || linkSelectionDisabled) return;
    setPickerOpen((v) => {
      const next = !v;
      if (next && detachPicker) {
        queueMicrotask(() => updatePickerPos());
      }
      return next;
    });
  };

  const pillRowClass = `${displayLinked ? linkedClassName : unlinkedClassName} ${
    isPending ? "opacity-70" : ""
  } ${linkSelectionDisabled && !displayLinked ? "opacity-55" : ""} flex max-w-full min-w-0 items-end gap-0.5`;

  const levelMeta = displayLevel ? COVERAGE_LEVEL_META[displayLevel] : null;

  const pickerInner = (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1.5 shadow-lg" role="listbox" aria-label="Abdeckungsst\u00E4rke">
      {!(linkSelectionDisabled && displayLinked)
        ? COVERAGE_LEVEL_ORDER.map((key) => {
            const m = COVERAGE_LEVEL_META[key];
            return (
              <button
                key={key}
                type="button"
                title={m.labelDe}
                className="rounded-md px-2 py-1 text-lg leading-none hover:bg-zinc-100"
                onClick={() => runLink(key)}
              >
                {m.emoji}
              </button>
            );
          })
        : null}
      {unlinkInPickerOnly && displayLinked ? (
        <button
          type="button"
          title="Abwaehlen (Verkn\u00FCpfung entfernen)"
          className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium leading-none text-red-700 hover:bg-red-50"
          onClick={requestUnlink}
        >
          Abwaehlen
        </button>
      ) : null}
    </div>
  );

  const rootClass = fullWidth
    ? "relative flex w-full min-w-0 flex-col"
    : "relative inline-flex max-w-[min(340px,100%)] flex-col";

  return (
    <div ref={rootRef} className={rootClass}>
      <div className={pillRowClass}>
        <button
          ref={pillBtnRef}
          type="button"
          disabled={
            !canWrite ||
            isPending ||
            (linkSelectionDisabled && !displayLinked) ||
            (linkSelectionDisabled && displayLinked && !unlinkInPickerOnly)
          }
          onClick={openPicker}
          className="min-w-0 flex-1 cursor-pointer py-0.5 text-left leading-snug disabled:cursor-not-allowed"
          title={title}
        >
          <span className="flex items-end gap-1.5">
            <span className="min-w-0 flex-1">{children}</span>
            {displayLinked && levelMeta ? (
              <span
                className="shrink-0 text-[0.95rem] leading-none"
                title={`Abdeckung: ${levelMeta.labelDe}`}
              >
                {levelMeta.emoji}
              </span>
            ) : null}
          </span>
        </button>
        {displayLinked && !unlinkInPickerOnly ? (
          <button
            type="button"
            onClick={requestUnlink}
            disabled={!canWrite || isPending}
            className="shrink-0 self-end rounded px-0.5 pb-0.5 text-base leading-none text-red-600 hover:bg-red-100/80 disabled:opacity-50"
            title="Verkn\u00FCpfung entfernen"
            aria-label="Verkn\u00FCpfung entfernen"
          >
            ×
          </button>
        ) : null}
      </div>

      {pickerOpen && canWrite && (!linkSelectionDisabled || unlinkOnlyMode)
        ? detachPicker && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={pickerRef}
                className="pointer-events-auto z-[80]"
                style={{ position: "fixed", top: fixedPos.top, left: fixedPos.left }}
              >
                {pickerInner}
              </div>,
              document.body
            )
          : (
              <div ref={pickerRef} className="absolute left-0 top-full z-30 mt-1">
                {pickerInner}
              </div>
            )
        : null}
      {unlinkConfirmOpen ? (
        <ConfirmDialog
          title="Verknüpfung entfernen?"
          description="Die Abdeckungs-Verknüpfung wird aufgehoben."
          confirmLabel="Entfernen"
          pending={isPending}
          onCancel={() => setUnlinkConfirmOpen(false)}
          onConfirm={() => {
            setUnlinkConfirmOpen(false);
            void executeUnlink();
          }}
        />
      ) : null}
    </div>
  );
}
