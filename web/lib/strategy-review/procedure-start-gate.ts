export type StrategyReviewProcedureStartGate = {
  canStart: boolean;
  isReviewLead: boolean;
  canModerate: boolean;
  inLeadWindow: boolean;
  daysToEnd: number | null;
  leadTimeDays: number;
  /** Kurzer Hinweis, warum der Start blockiert ist (oder Override-Hinweis). */
  blockReason: string | null;
};

export function evaluateStrategyReviewProcedureStartGate(input: {
  membershipId: string;
  leadMembershipIds: string[];
  canModerate: boolean;
  daysToEnd: number | null;
  leadTimeDays: number;
}): StrategyReviewProcedureStartGate {
  const isReviewLead = input.leadMembershipIds.includes(input.membershipId);
  const inLeadWindow =
    input.daysToEnd != null ? input.daysToEnd <= input.leadTimeDays : false;
  const canStart =
    (isReviewLead || input.canModerate) && (inLeadWindow || input.canModerate);

  let blockReason: string | null = null;
  if (!canStart) {
    if (!isReviewLead && !input.canModerate) {
      blockReason =
        "Nur die Review-Leitung oder Personen mit Moderationsrecht können den Verfahrensstart auslösen.";
    } else if (!inLeadWindow) {
      const days =
        input.daysToEnd != null ? String(input.daysToEnd) : "unbekannt";
      blockReason = `Das Lead-Fenster ist noch nicht offen (noch ${days} Tage bis Periodenende, Vorlauf ${input.leadTimeDays} Tage). Mit Moderationsrecht ist ein Override möglich.`;
    }
  } else if (!inLeadWindow && input.canModerate) {
    blockReason =
      "Lead-Fenster noch nicht offen — Start erfolgt als Moderations-Override.";
  }

  return {
    canStart,
    isReviewLead,
    canModerate: input.canModerate,
    inLeadWindow,
    daysToEnd: input.daysToEnd,
    leadTimeDays: input.leadTimeDays,
    blockReason,
  };
}
