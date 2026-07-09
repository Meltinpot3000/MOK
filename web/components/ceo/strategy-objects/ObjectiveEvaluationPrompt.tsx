"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { runSingleObjectiveEvaluation } from "@/app/(ceo)/strategy-cycle/actions";

const STORAGE_PREFIX = "objective-eval-prompt-";

/**
 * Zeigt nach «Revision übernehmen» eines Ziels (success=draft-promoted & eval_objective=<id>)
 * eine Nachfrage, ob die Sentinel✨-Bewertung jetzt neu berechnet werden soll.
 * sessionStorage verhindert erneutes Anzeigen bei Refresh.
 */
export function ObjectiveEvaluationPrompt({
  enabled,
  returnPath,
}: {
  enabled: boolean;
  returnPath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const objectiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !enabled) return;
    const success = searchParams.get("success");
    const objectiveId = searchParams.get("eval_objective");
    if (success !== "draft-promoted" || !objectiveId) return;
    const key = `${STORAGE_PREFIX}${objectiveId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    objectiveIdRef.current = objectiveId;
    setOpen(true);
  }, [searchParams, enabled]);

  if (!open || !objectiveIdRef.current) return null;

  const clearEvalParam = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("eval_objective");
    router.replace(`?${params.toString()}`);
  };

  const dismiss = () => {
    setOpen(false);
    clearEvalParam();
  };

  const confirm = async () => {
    const objectiveId = objectiveIdRef.current;
    if (!objectiveId) return;
    setPending(true);
    const fd = new FormData();
    fd.set("objective_id", objectiveId);
    fd.set("return_path", returnPath);
    try {
      await runSingleObjectiveEvaluation(fd);
      router.refresh();
    } finally {
      setPending(false);
      setOpen(false);
    }
  };

  return (
    <ConfirmDialog
      title="Sentinel✨-Bewertung neu berechnen?"
      description="Die Revision ist jetzt aktiv und die bisherige Sentinel✨-Bewertung ist veraltet. Möchten Sie die Bewertung für dieses Ziel jetzt neu berechnen? Das kann einen Moment dauern."
      confirmLabel="Ja, jetzt berechnen"
      cancelLabel="Später"
      pending={pending}
      onCancel={dismiss}
      onConfirm={() => void confirm()}
    />
  );
}
