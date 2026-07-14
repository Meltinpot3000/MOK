export const STRATEGIC_THEME_CANONICAL_MAP = {
  capabilities: [
    "expertise",
    "skill",
    "skills",
    "knowhow",
    "know-how",
    "competence",
    "competency",
    "capability",
    "capabilities",
    "qualification",
    "training",
    "build up expertise",
    "rebuild knowledge",
  ],
  knowledge: [
    "knowledge",
    "knowhow",
    "know-how",
    "know how",
    "knowledge position",
    "rebuild knowledge",
    "rebuilding the knowledge",
  ],
  engineering: [
    "engineering",
    "engineer",
    "technical",
    "technology",
    "product development",
    "application",
    "applications",
    "innovation",
    "r&d",
  ],
  operations: [
    "opex",
    "operational",
    "operations",
    "production",
    "manufacturing",
    "shopfloor",
    "efficiency",
    "productivity",
    "reduce production costs",
    "cost reduction",
    "process efficiency",
  ],
  digitalization: [
    "digitalisation",
    "digitalization",
    "digital",
    "automation",
    "systems",
    "data",
    "integration",
    "workflow",
    "platform",
    "software",
    "erp",
    "mdm",
  ],
  market_customer: [
    "market",
    "customer",
    "sales",
    "growth",
    "region",
    "americas",
    "market expansion",
    "customer strategy",
    "automotive applications",
  ],
  organization_leadership: [
    "organization",
    "organisation",
    "leadership",
    "corporate leadership",
    "leadership culture",
    "corporate culture",
    "management",
    "staff",
    "culture",
    "people",
    "governance",
    "roles",
    "responsibilities",
    "collaboration",
    "staff development",
    "management development",
    "management and staff development",
    "talent development",
    "people development",
  ],
  process_governance: [
    "process",
    "processes",
    "standard",
    "standards",
    "governance",
    "operating model",
    "tom",
    "handover",
    "decision rights",
  ],
} as const;

export type StrategicTheme = keyof typeof STRATEGIC_THEME_CANONICAL_MAP;

const THEME_LABEL_PARTS: Record<StrategicTheme, string> = {
  operations: "Operative Exzellenz",
  digitalization: "Digitalisierung",
  market_customer: "Markt- und Kundenstrategie",
  capabilities: "Fähigkeiten",
  knowledge: "Wissen",
  engineering: "Innovation und Engineering",
  organization_leadership: "Organisation, Führung und Fähigkeiten",
  process_governance: "Prozess-Governance und Operating Model",
};

export function normalizeSemanticText(text: string): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-zäöüß0-9\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizeStrategicThemes(text: string): StrategicTheme[] {
  const normalized = normalizeSemanticText(text);
  if (!normalized) return [];

  const themes = new Set<StrategicTheme>();
  for (const [theme, phrases] of Object.entries(STRATEGIC_THEME_CANONICAL_MAP) as Array<
    [StrategicTheme, readonly string[]]
  >) {
    const sorted = [...phrases].sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
      const needle = normalizeSemanticText(phrase);
      if (needle && normalized.includes(needle)) {
        themes.add(theme);
        break;
      }
    }
  }

  if (themes.has("capabilities") && /\b(knowledge|knowhow|know how|expertise)\b/.test(normalized)) {
    themes.add("knowledge");
  }

  refineCanonicalThemes(normalized, themes);

  return [...themes];
}

const PEOPLE_DEVELOPMENT_PATTERN =
  /\b(staff development|management development|management and staff|people development|talent development)\b/;

function refineCanonicalThemes(normalized: string, themes: Set<StrategicTheme>): void {
  const hasPeopleContext = /\b(staff|management|leadership|people|talent|organisation|organization)\b/.test(
    normalized
  );
  const hasPeopleDevelopment =
    PEOPLE_DEVELOPMENT_PATTERN.test(normalized) ||
    (hasPeopleContext && /\bdevelopment\b/.test(normalized));

  if (hasPeopleDevelopment) {
    themes.add("organization_leadership");
    themes.add("capabilities");
    themes.delete("engineering");
  }

  if (
    /\b(leadership culture|corporate leadership|corporate culture|führungskultur|unternehmenskultur)\b/.test(
      normalized
    )
  ) {
    themes.add("organization_leadership");
  }

  if (/\b(build up expertise|expertise|skills|competence|competency|training)\b/.test(normalized)) {
    themes.add("capabilities");
  }
}

export function strategicThemeAffinity(
  themesA: StrategicTheme[],
  themesB: StrategicTheme[]
): number {
  const setA = new Set(themesA);
  const setB = new Set(themesB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const theme of setA) {
    if (setB.has(theme)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  let score = union <= 0 ? 0 : intersection / union;

  if (setA.has("organization_leadership") && setB.has("organization_leadership")) {
    score = Math.max(score, 0.65);
  }

  const orgCapBridge =
    (setA.has("organization_leadership") &&
      (setB.has("capabilities") || setB.has("knowledge"))) ||
    (setB.has("organization_leadership") &&
      (setA.has("capabilities") || setA.has("knowledge")));

  if (orgCapBridge) {
    score = Math.max(score, 0.55);
  }

  const engCapBridge =
    (setA.has("engineering") && (setB.has("capabilities") || setB.has("knowledge"))) ||
    (setB.has("engineering") && (setA.has("capabilities") || setA.has("knowledge")));

  if (engCapBridge) {
    score = Math.max(score, 0.55);
  }

  return Number(score.toFixed(3));
}

export function labelFromCanonicalThemes(themes: StrategicTheme[]): string {
  const unique = [...new Set(themes)];
  if (unique.length === 0) return "Strategisches Handlungsfeld";

  const sorted = [...unique].sort((a, b) => a.localeCompare(b, "de"));

  if (sorted.includes("operations") && sorted.includes("digitalization")) {
    return "Operative Exzellenz und Digitalisierung";
  }
  if (sorted.includes("engineering") && (sorted.includes("capabilities") || sorted.includes("knowledge"))) {
    return "Innovation und Engineering";
  }
  if (sorted.includes("organization_leadership") && sorted.includes("capabilities")) {
    return "Organisation, Führung und Fähigkeiten";
  }
  if (sorted.length === 1) {
    return THEME_LABEL_PARTS[sorted[0]] ?? "Strategisches Handlungsfeld";
  }

  const labels = sorted
    .map((theme) => THEME_LABEL_PARTS[theme])
    .filter((label): label is string => Boolean(label));
  return labels.slice(0, 2).join(" und ") || "Strategisches Handlungsfeld";
}

export function extractDirectionCode(title: string): string {
  const match = title.match(/^([A-Z0-9_]+)\s*[-–—]/i);
  return match?.[1] ?? "";
}
