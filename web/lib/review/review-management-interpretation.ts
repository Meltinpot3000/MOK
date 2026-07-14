/**
 * Regelbasierte Management-Interpretation für das Review-Lagebild.
 */
import type { ReviewLagebildSnapshot } from "./review-lagebild";
import type { EnrichedStrategicDirectionReviewSummary } from "./review-direction-status";
import type { ReviewCycleInitiativeInput } from "./review-cycle-view-model";

export function buildReviewManagementInterpretation(input: {
  lagebild: ReviewLagebildSnapshot;
  enrichedSummaries: EnrichedStrategicDirectionReviewSummary[];
  initiativeRows: ReviewCycleInitiativeInput[];
  revisitFeedbackCount: number;
}): string[] {
  const sentences: string[] = [];
  const { lagebild, enrichedSummaries, initiativeRows, revisitFeedbackCount } = input;

  const prioritizedNoCoverage = enrichedSummaries.filter(
    (d) =>
      d.reviewStatus === "no_coverage" &&
      (d.status === "active" || d.priority <= 2)
  ).length;
  if (prioritizedNoCoverage > 0) {
    sentences.push(
      `${prioritizedNoCoverage} priorisierte Stoßrichtung${prioritizedNoCoverage === 1 ? "" : "en"} haben keine operative Abdeckung.`
    );
  }

  const heavyBehind = initiativeRows.filter((i) => {
    if (i.weight < 5) return false;
    const h = i.status;
    if (h !== "active" && h !== "at_risk" && h !== "planned") return false;
    return i.progress_percent < Math.max(0, lagebild.timeProgressPercent - 20);
  }).length;
  if (heavyBehind > 0 && lagebild.timeProgressPercent > 20) {
    sentences.push(
      `${heavyBehind} gewichtige Initiative${heavyBehind === 1 ? "" : "n"} liegen deutlich hinter dem erwarteten Fortschritt.`
    );
  }

  if (revisitFeedbackCount > 0) {
    sentences.push(
      `${revisitFeedbackCount} Thema${revisitFeedbackCount === 1 ? "" : "en"} sollte${revisitFeedbackCount === 1 ? "" : "n"} in den Strategiezyklus zurückgespiegelt werden.`
    );
  }

  if (lagebild.directionsOffTrackCount > 0) {
    sentences.push(
      `${lagebild.directionsOffTrackCount} Stoßrichtung${lagebild.directionsOffTrackCount === 1 ? "" : "en"} ist kritisch — sofortige Steuerung erforderlich.`
    );
  }

  if (lagebild.deltaPp !== null && lagebild.deltaPp < -15 && lagebild.timeProgressPercent > 20) {
    sentences.push(
      `Die Umsetzung liegt ${Math.abs(lagebild.deltaPp)} Prozentpunkte hinter dem Zeitplan des Reviewzyklus.`
    );
  }

  if (sentences.length === 0) {
    sentences.push("Das Umsetzungslagebild zeigt keine kritischen Ausnahmen nach den aktuellen Regeln.");
  }

  return sentences.slice(0, 5);
}
