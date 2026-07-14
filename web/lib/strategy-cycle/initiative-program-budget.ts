export function buildProgramOptionsForInitiativeForm(
  programs: Array<{ id: string; title: string; status?: string; budget_total?: number | null }>,
  initiatives: Array<{ id?: string; program_id: string | null; budget?: number | null }>,
  openOnly = true
): InitiativeProgramOption[] {
  const openStatuses = new Set(["draft", "on_hold", "active"]);
  return programs
    .filter((p) => !openOnly || openStatuses.has(String(p.status ?? "draft")))
    .map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      budgetTotal: p.budget_total != null ? Number(p.budget_total) : null,
      allocatedBudget: sumInitiativeBudgets(
        initiatives.map((i) => ({
          id: i.id,
          program_id: i.program_id,
          budget: i.budget != null ? Number(i.budget) : null,
        })),
        p.id
      ),
    }));
}

export type InitiativeProgramOption = {
  id: string;
  title: string;
  status?: string;
  budgetTotal: number | null;
  allocatedBudget: number;
};

export function formatChfAmount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "–";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseInitiativeBudgetInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/'/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export function sumInitiativeBudgets(
  initiatives: Array<{ program_id: string | null; budget: number | null; id?: string }>,
  programId: string,
  excludeInitiativeId?: string
): number {
  return initiatives
    .filter((i) => i.program_id === programId && i.id !== excludeInitiativeId)
    .reduce((sum, i) => sum + (Number(i.budget) || 0), 0);
}

export function remainingProgramBudget(
  program: Pick<InitiativeProgramOption, "budgetTotal" | "allocatedBudget">,
  excludeFromAllocated = 0
): number | null {
  if (program.budgetTotal == null) return null;
  return Math.max(0, program.budgetTotal - program.allocatedBudget + excludeFromAllocated);
}

export function validateInitiativeBudgetAgainstProgram(input: {
  programBudgetTotal: number | null;
  otherInitiativesAllocated: number;
  requestedBudget: number | null;
}): string | null {
  const { programBudgetTotal, otherInitiativesAllocated, requestedBudget } = input;
  if (requestedBudget == null) return null;
  if (programBudgetTotal == null) {
    return "Für dieses Programm ist kein Budget hinterlegt — Budget-Lokalisierung ist nicht möglich.";
  }
  const nextTotal = otherInitiativesAllocated + requestedBudget;
  if (nextTotal > programBudgetTotal + 0.001) {
    return `Budget überschreitet Programm-Rahmen (${formatChfAmount(programBudgetTotal)}). Verfügbar: ${formatChfAmount(Math.max(0, programBudgetTotal - otherInitiativesAllocated))}.`;
  }
  return null;
}
