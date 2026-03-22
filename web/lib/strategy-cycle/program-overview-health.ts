/**
 * Programm-Gesundheit aus aggregierten Initiativen (nicht persistiert).
 * Siehe View app.v_program_overview: Fortschritt = Durchschnitt progress_percent.
 */
export type ProgramOverviewHealth = "grey" | "green" | "yellow" | "red";

export type ProgramOverviewHealthInput = {
  initiativeActiveCount: number;
  progressPercent: number;
};

export function deriveProgramOverviewHealth(input: ProgramOverviewHealthInput): ProgramOverviewHealth {
  if (input.initiativeActiveCount === 0) return "grey";
  const p = Number(input.progressPercent);
  if (!Number.isFinite(p)) return "grey";
  if (p >= 70) return "green";
  if (p >= 30) return "yellow";
  return "red";
}

export function programOverviewHealthLabelDe(health: ProgramOverviewHealth): string {
  switch (health) {
    case "grey":
      return "Keine aktive Initiative";
    case "green":
      return "Fortschritt gut (≥70 %)";
    case "yellow":
      return "Fortschritt mittel (30–69 %)";
    case "red":
      return "Fortschritt niedrig (<30 %)";
    default:
      return health;
  }
}
