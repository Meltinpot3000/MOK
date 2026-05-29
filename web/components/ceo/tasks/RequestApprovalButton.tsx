"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitForApprovalAction } from "@/lib/tasks/approval-actions";
import type { ApprovalSourceObjectType } from "@/lib/tasks/approval-source-types";

const defaultButtonClassName =
  "rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 hover:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-50";

type RequestApprovalButtonProps = {
  organizationId: string;
  sourceObjectType: ApprovalSourceObjectType;
  sourceObjectId: string;
  objectTitle: string;
  description?: string | null;
  disabled?: boolean;
  /** Native Tooltip (z. B. wenn deaktiviert). */
  title?: string;
  /** Anzeige-Label; Standard deutsch für den Workspace. */
  label?: string;
  className?: string;
};

export function RequestApprovalButton({
  organizationId,
  sourceObjectType,
  sourceObjectId,
  objectTitle,
  description,
  disabled,
  title,
  label = "Freigabe anfragen",
  className,
}: RequestApprovalButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      title={title}
      disabled={disabled || pending}
      className={className ?? defaultButtonClassName}
      onClick={() => {
        startTransition(async () => {
          const r = await submitForApprovalAction({
            organizationId,
            sourceObjectType,
            sourceObjectId,
            title: `Freigabe: ${objectTitle.trim() || sourceObjectType}`,
            description: description ?? null,
          });
          if (!r.ok) {
            window.alert(r.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
