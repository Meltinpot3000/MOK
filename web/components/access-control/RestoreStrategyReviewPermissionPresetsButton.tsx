"use client";

import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";

type Props = {
  disabled: boolean;
  formAction: (formData: FormData) => void | Promise<void>;
};

export function RestoreStrategyReviewPermissionPresetsButton({
  disabled,
  formAction,
}: Props) {
  return (
    <ConfirmBeforeSubmitForm
      action={formAction}
      title="Strategie-Review-Standardrechte wiederherstellen?"
      description="Die Standardrechte für org_admin, executive, department_lead und team_member werden gesetzt. Andere Rollen bleiben unverändert."
      confirmLabel="Wiederherstellen"
    >
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-950 hover:bg-amber-100 disabled:opacity-50"
      >
        Standard wiederherstellen
      </button>
    </ConfirmBeforeSubmitForm>
  );
}
