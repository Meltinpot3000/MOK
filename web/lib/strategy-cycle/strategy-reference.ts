export type StrategyReferenceFields = {
  mission: string;
  vision: string;
  culture: string;
  values: string;
  leadership: string;
};

function normalizeText(value: unknown, maxLength: number): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.slice(0, maxLength);
}

export function readStrategyReferenceFieldsFromBrandingConfig(brandingConfig: unknown): StrategyReferenceFields {
  if (!brandingConfig || typeof brandingConfig !== "object") {
    return { mission: "", vision: "", culture: "", values: "", leadership: "" };
  }
  const root = brandingConfig as Record<string, unknown>;
  const fields: StrategyReferenceFields = {
    mission: normalizeText(root.strategy_reference_mission, 3000),
    vision: normalizeText(root.strategy_reference_vision, 3000),
    culture: normalizeText(root.strategy_reference_culture, 3000),
    values: normalizeText(root.strategy_reference_values, 3000),
    leadership: normalizeText(root.strategy_reference_leadership, 3000),
  };

  if (!fields.mission && !fields.vision && !fields.culture && !fields.values && !fields.leadership) {
    const legacy = normalizeText(root.strategy_reference_text, 3000);
    if (legacy) {
      return { mission: legacy, vision: "", culture: "", values: "", leadership: "" };
    }
  }
  return fields;
}

export function buildStrategyReferenceText(fields: StrategyReferenceFields): string | null {
  const sections = [
    fields.mission ? `Mission:\n${fields.mission}` : "",
    fields.vision ? `Vision:\n${fields.vision}` : "",
    fields.culture ? `Culture:\n${fields.culture}` : "",
    fields.values ? `Values:\n${fields.values}` : "",
    fields.leadership ? `Leadership:\n${fields.leadership}` : "",
  ].filter(Boolean);
  if (sections.length === 0) return null;
  return sections.join("\n\n");
}
