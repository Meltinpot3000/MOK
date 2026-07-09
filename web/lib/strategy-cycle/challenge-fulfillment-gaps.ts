import type { CoverageBand } from "@/lib/strategy-cycle/strategic-design-insights";

export type FulfillmentGap = {
  id: string;
  labelDe: string;
  href: string;
};

export type FulfillmentGapInput = {
  addressing: CoverageBand;
  linkedDirectionCount: number;
  annualTargetCountOnDirections: number;
  initiativeCountOnDirections: number;
  keyResultLinkCountOnDirections: number;
  executionAnchorCount: number;
  executionPercent: number | null;
};

/** Konkrete Hinweise, wo Nutzer Fortschritt erfassen können, damit der Erfüllungsgrad messbar wird. */
export function deriveFulfillmentGaps(input: FulfillmentGapInput): FulfillmentGap[] {
  const gaps: FulfillmentGap[] = [];

  if (input.linkedDirectionCount === 0 || input.addressing === "none") {
    gaps.push({
      id: "link_directions",
      labelDe: "Herausforderung mit Stoßrichtungen verknüpfen (Beitragsstufe setzen)",
      href: "/strategy-cycle?l1=strategic-directions&l2=challenges",
    });
    return gaps;
  }

  if (input.annualTargetCountOnDirections === 0) {
    gaps.push({
      id: "annual_targets",
      labelDe: "Jahresziele zu den verknüpften Stoßrichtungen anlegen und Fortschritt (%) pflegen",
      href: "/annual-targets",
    });
  }

  if (input.initiativeCountOnDirections === 0 && input.keyResultLinkCountOnDirections === 0) {
    gaps.push({
      id: "initiatives_or_okr",
      labelDe:
        "Initiativen unter Programmen pflegen oder OKR-Key-Results mit Jahreszielen verknüpfen",
      href: "/strategy-cycle?l1=pips&l2=initiativen",
    });
  }

  if (
    input.annualTargetCountOnDirections > 0 &&
    input.keyResultLinkCountOnDirections === 0 &&
    input.initiativeCountOnDirections === 0
  ) {
    gaps.push({
      id: "okr_traceability",
      labelDe: "OKR-Key-Results im Strategiezyklus mit Jahreszielen verknüpfen (Traceability)",
      href: "/okr/planning",
    });
  }

  if (input.executionAnchorCount === 0) {
    gaps.push({
      id: "review_progress",
      labelDe: "Fortschritt in Review oder OKR-Tracking aktualisieren (Check-ins / Initiativen-%)",
      href: "/okr/tracking",
    });
    return gaps;
  }

  if (input.executionPercent === 0) {
    gaps.push({
      id: "update_progress",
      labelDe: "Bestehende Anker haben 0 % — Fortschritt bei Jahreszielen, Initiativen oder Key Results erhöhen",
      href: "/reviews",
    });
  }

  return gaps;
}
