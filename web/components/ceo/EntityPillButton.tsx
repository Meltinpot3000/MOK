"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function EntityPillButton({
  entityKey,
  entityValue,
  extraFields,
  isLinked,
  linkAction,
  unlinkAction,
  children,
  title,
  canWrite,
  linkedClassName,
  unlinkedClassName,
}: {
  entityKey: string;
  entityValue: string;
  extraFields: Record<string, string>;
  isLinked: boolean;
  linkAction: (fd: FormData) => Promise<void>;
  unlinkAction: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
  title?: string;
  canWrite: boolean;
  linkedClassName: string;
  unlinkedClassName: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [optimisticLinked, setOptimisticLinked] = useState<boolean | null>(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const displayLinked = optimisticLinked !== null ? optimisticLinked : isLinked;

  useEffect(() => {
    if (optimisticLinked !== null && isLinked === optimisticLinked) {
      setOptimisticLinked(null);
    }
  }, [isLinked, optimisticLinked]);

  const executeToggle = async () => {
    if (!canWrite || isPending) return;
    const fd = new FormData();
    fd.set(entityKey, entityValue);
    fd.set("_noRedirect", "1");
    for (const [k, v] of Object.entries(extraFields)) fd.set(k, v);
    const action = isLinked ? unlinkAction : linkAction;
    setOptimisticLinked(!isLinked);
    setIsPending(true);
    try {
      await action(fd);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  };

  const handleClick = async () => {
    if (!canWrite || isPending) return;
    if (isLinked) {
      setUnlinkConfirmOpen(true);
      return;
    }
    await executeToggle();
  };

  const className = displayLinked ? linkedClassName : unlinkedClassName;

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={!canWrite || isPending}
        className={`flex items-center gap-1.5 ${className} ${isPending ? "opacity-70" : ""}`}
        title={title}
      >
        {children}
        {displayLinked && <span className="ml-0.5 text-red-600">×</span>}
      </button>
      {unlinkConfirmOpen ? (
        <ConfirmDialog
          title="Verknüpfung entfernen?"
          description="Die Zuordnung wird aufgehoben."
          confirmLabel="Entfernen"
          onCancel={() => setUnlinkConfirmOpen(false)}
          onConfirm={() => {
            setUnlinkConfirmOpen(false);
            void executeToggle();
          }}
        />
      ) : null}
    </>
  );
}
