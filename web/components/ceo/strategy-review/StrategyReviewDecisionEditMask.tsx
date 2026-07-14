"use client";

export type DecisionObjectKind = "challenge" | "direction" | "objective";

export type DecisionFieldValues = {
  title: string;
  description: string;
  // challenge
  impact_score?: number;
  urgency_score?: number;
  scope_score?: number;
  root_cause_score?: number;
  // direction
  priority?: number;
  grouping?: string;
  strategic_value_score?: number;
  capability_fit_score?: number;
  feasibility_score?: number;
  risk_score?: number;
  // objective
  time_horizon?: string;
  importance_score?: number;
};

const FORM_INPUT =
  "mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 shadow-sm disabled:bg-zinc-50";
const FORM_LABEL = "block text-xs font-medium text-zinc-700";

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/** Startwerte aus Pre-Read / Listenobjekt. */
export function seedDecisionFieldsFromSource(
  kind: DecisionObjectKind,
  source: Record<string, unknown> | null | undefined,
  fallbackTitle: string,
  fallbackDescription: string
): DecisionFieldValues {
  const s = source ?? {};
  const base: DecisionFieldValues = {
    title: str(s.title, fallbackTitle),
    description: str(s.description, fallbackDescription),
  };
  if (kind === "challenge") {
    return {
      ...base,
      impact_score: num(s.impact_score, 3),
      urgency_score: num(s.urgency_score, 3),
      scope_score: num(s.scope_score, 3),
      root_cause_score: num(s.root_cause_score, 3),
    };
  }
  if (kind === "direction") {
    return {
      ...base,
      priority: num(s.priority, 3),
      grouping: str(s.grouping),
      strategic_value_score: num(s.strategic_value_score, 3),
      capability_fit_score: num(s.capability_fit_score, 3),
      feasibility_score: num(s.feasibility_score, 3),
      risk_score: num(s.risk_score ?? s.risk_level, 3),
    };
  }
  return {
    ...base,
    time_horizon: str(s.time_horizon),
    importance_score: num(s.importance_score, 3),
  };
}

export function decisionFieldsComplete(kind: DecisionObjectKind, fields: DecisionFieldValues | undefined): boolean {
  if (!fields?.title?.trim()) return false;
  return true;
}

export function StrategyReviewDecisionEditMask({
  kind,
  mode,
  values,
  disabled,
  onChange,
}: {
  kind: DecisionObjectKind;
  mode: "adjust" | "replace";
  values: DecisionFieldValues;
  disabled?: boolean;
  onChange: (next: DecisionFieldValues) => void;
}) {
  const patch = (partial: Partial<DecisionFieldValues>) => onChange({ ...values, ...partial });
  const heading =
    mode === "replace"
      ? "Neues Element (ersetzt das bisherige — bisheriges wird inaktiviert)"
      : "Felder anpassen (wie im Strategiezyklus)";

  return (
    <div className="mt-3 space-y-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-900">{heading}</p>
      <label className={FORM_LABEL}>
        Titel
        <input
          className={FORM_INPUT}
          value={values.title}
          disabled={disabled}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </label>
      <label className={FORM_LABEL}>
        Beschreibung
        <textarea
          rows={3}
          className={FORM_INPUT}
          value={values.description}
          disabled={disabled}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </label>

      {kind === "challenge" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ["impact_score", "Auswirkung"],
              ["urgency_score", "Dringlichkeit"],
              ["scope_score", "Scope"],
              ["root_cause_score", "Ursache"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={FORM_LABEL}>
              {label} (1–5)
              <input
                type="number"
                min={1}
                max={5}
                className={FORM_INPUT}
                value={values[key] ?? 3}
                disabled={disabled}
                onChange={(e) => patch({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      ) : null}

      {kind === "direction" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className={FORM_LABEL}>
            Priorität (1–5)
            <input
              type="number"
              min={1}
              max={5}
              className={FORM_INPUT}
              value={values.priority ?? 3}
              disabled={disabled}
              onChange={(e) => patch({ priority: Number(e.target.value) })}
            />
          </label>
          <label className={FORM_LABEL}>
            Gruppierung
            <input
              className={FORM_INPUT}
              value={values.grouping ?? ""}
              disabled={disabled}
              onChange={(e) => patch({ grouping: e.target.value })}
            />
          </label>
          <label className={FORM_LABEL}>
            Strategischer Wert
            <input
              type="number"
              min={1}
              max={5}
              className={FORM_INPUT}
              value={values.strategic_value_score ?? 3}
              disabled={disabled}
              onChange={(e) => patch({ strategic_value_score: Number(e.target.value) })}
            />
          </label>
          <label className={FORM_LABEL}>
            Capability Fit
            <input
              type="number"
              min={1}
              max={5}
              className={FORM_INPUT}
              value={values.capability_fit_score ?? 3}
              disabled={disabled}
              onChange={(e) => patch({ capability_fit_score: Number(e.target.value) })}
            />
          </label>
          <label className={FORM_LABEL}>
            Machbarkeit
            <input
              type="number"
              min={1}
              max={5}
              className={FORM_INPUT}
              value={values.feasibility_score ?? 3}
              disabled={disabled}
              onChange={(e) => patch({ feasibility_score: Number(e.target.value) })}
            />
          </label>
          <label className={FORM_LABEL}>
            Risiko
            <input
              type="number"
              min={1}
              max={5}
              className={FORM_INPUT}
              value={values.risk_score ?? 3}
              disabled={disabled}
              onChange={(e) => patch({ risk_score: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}

      {kind === "objective" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className={FORM_LABEL}>
            Zeithorizont
            <input
              className={FORM_INPUT}
              value={values.time_horizon ?? ""}
              disabled={disabled}
              onChange={(e) => patch({ time_horizon: e.target.value })}
            />
          </label>
          <label className={FORM_LABEL}>
            Wichtigkeit (1–5)
            <input
              type="number"
              min={1}
              max={5}
              className={FORM_INPUT}
              value={values.importance_score ?? 3}
              disabled={disabled}
              onChange={(e) => patch({ importance_score: Number(e.target.value) })}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
