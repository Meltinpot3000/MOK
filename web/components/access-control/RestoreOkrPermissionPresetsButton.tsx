"use client";

type Props = {
  disabled: boolean;
  formAction: (formData: FormData) => void | Promise<void>;
};

export function RestoreOkrPermissionPresetsButton({ disabled, formAction }: Props) {
  return (
    <form action={formAction}>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-950 hover:bg-amber-100 disabled:opacity-50"
        onClick={(e) => {
          if (
            disabled ||
            !window.confirm(
              "Standard-OKR-Objektrechte für org_admin, executive, department_lead und team_member wiederherstellen? Andere Rollen bleiben unverändert."
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        Standard wiederherstellen
      </button>
    </form>
  );
}
