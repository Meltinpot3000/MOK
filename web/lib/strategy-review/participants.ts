export const STRATEGY_REVIEW_PARTICIPANT_ROLES = [
  {
    code: "lead",
    label: "Review-Leitung",
    description:
      "Moderiert den Ablauf: Ankündigung, Vorab-Unterlagen, Meeting und Freigabe. Verantwortlich für den Verfahrensfortschritt.",
  },
  {
    code: "stakeholder",
    label: "Stakeholder",
    description:
      "Gibt Vorab-Feedback zu Herausforderungen, Stoßrichtungen und Zielen und bringt die fachliche Perspektive ein.",
  },
  {
    code: "decision_maker",
    label: "Entscheider",
    description:
      "Trifft oder bestätigt Entscheidungen im Meeting und trägt die Freigabe der Review-Ergebnisse mit.",
  },
  {
    code: "contributor",
    label: "Mitwirkende/r",
    description:
      "Liefert Inhalte und Einschätzungen zu einzelnen Themen, ohne die Gesamtmoderation zu führen.",
  },
  {
    code: "observer",
    label: "Beobachter",
    description:
      "Nimmt am Review teil, um den Stand zu verfolgen — ohne eigenes Feedback- oder Entscheidungspflichten.",
  },
] as const;

export type StrategyReviewParticipantRole =
  (typeof STRATEGY_REVIEW_PARTICIPANT_ROLES)[number]["code"];

export function strategyReviewParticipantRoleLabel(role: string): string {
  const found = STRATEGY_REVIEW_PARTICIPANT_ROLES.find((r) => r.code === role);
  return found?.label ?? role;
}

export function isStrategyReviewParticipantRole(
  value: string
): value is StrategyReviewParticipantRole {
  return STRATEGY_REVIEW_PARTICIPANT_ROLES.some((r) => r.code === value);
}

export type StrategyReviewParticipant = {
  id: string;
  review_id: string;
  membership_id: string;
  review_role: StrategyReviewParticipantRole;
  invited_at: string;
  display_name: string;
  org_roles_label: string;
};

export type StrategyReviewMemberOption = {
  membership_id: string;
  display_name: string;
  org_roles_label: string;
};
