/**
 * Strategy-Review-Fenster am Reviewzyklus (L2): Lead Time vor Periodenende.
 */
import type { ReviewTriggerState } from "@/lib/strategy-review/types";

export type ReviewCyclePulseModel = {
  cycleInstanceId: string;
  cycleLabel: string;
  cycleStart: string;
  cycleEnd: string;
  timeProgressPercent: number;
  contentProgressPercent: number | null;
  deltaPp: number | null;
  leadTimeDays: number;
  daysToEnd: number | null;
  inLeadWindow: boolean;
  procedureStatus: string | null;
  readinessStatus: string | null;
  reviewId: string | null;
  trigger: ReviewTriggerState | null;
};

export function buildStrategyReviewHref(
  cycleInstanceId: string,
  trigger?: ReviewTriggerState | null
): string {
  const sp = new URLSearchParams();
  sp.set("instance", cycleInstanceId);
  if (trigger?.review_id) sp.set("review", trigger.review_id);
  const state = trigger?.state;
  let focus = "preparation";
  if (state === "ready_for_review" || state === "in_progress") focus = "meeting";
  else if (state === "decision_captured") focus = "release";
  else if (state === "completed") focus = "summary";
  else if (
    trigger?.procedure_status === "pre_read_open" ||
    trigger?.procedure_status === "ready_for_review"
  ) {
    focus = "feedback";
  }
  sp.set("focus", focus);
  const href = `/reviews/strategy-review?${sp.toString()}`;
  if (focus === "feedback") return `${href}#strategy-review-feedback`;
  return href;
}

export function readinessStatusLabelDe(status: string | null | undefined): string {
  switch (status) {
    case "ready":
      return "Bereit fürs Meeting";
    case "partially_ready":
      return "Teilweise bereit";
    case "not_ready":
      return "Noch nicht bereit";
    default:
      return status?.trim() ? status : "Unbekannt";
  }
}

export function readinessStatusHintDe(status: string | null | undefined): string {
  switch (status) {
    case "ready":
      return "Alle Themen im Vorab-Paket haben mindestens eine Bewertung.";
    case "partially_ready":
      return "Ein Teil der Themen ist bewertet — Feedback noch unvollständig.";
    case "not_ready":
      return "Noch kein ausreichendes Stakeholder-Feedback für das Review-Meeting.";
    default:
      return "Bereitschaft basiert auf eingegangenen Feedback-Bewertungen.";
  }
}

export function procedureStatusLabelDe(status: string | null | undefined): string {
  switch (status) {
    case "not_started":
      return "Nicht gestartet";
    case "announcement_sent":
      return "Angekündigt";
    case "pre_read_open":
      return "Vorab & Feedback offen";
    case "ready_for_review":
      return "Bereit für Meeting";
    case "review_in_progress":
      return "Meeting läuft";
    case "decision_captured":
      return "Entscheidungen erfasst";
    case "released":
      return "Freigegeben";
    case "cancelled":
      return "Abgebrochen";
    default:
      return status?.trim() ? status : "—";
  }
}

export function describeLeadWindow(
  model: Pick<
    ReviewCyclePulseModel,
    "inLeadWindow" | "daysToEnd" | "leadTimeDays" | "procedureStatus" | "trigger"
  >
): { title: string; detail: string; ctaLabel: string } {
  const days = model.daysToEnd;
  if (model.trigger?.state === "completed" || model.procedureStatus === "released") {
    return {
      title: "Strategie-Review abgeschlossen",
      detail: "Entscheidungen sind freigegeben.",
      ctaLabel: "Zusammenfassung öffnen",
    };
  }
  if (model.procedureStatus === "review_in_progress") {
    return {
      title: "Review-Meeting läuft",
      detail: "Entscheidungen zu Stoßrichtungen, Herausforderungen und Zielen erfassen.",
      ctaLabel: "Zum Meeting",
    };
  }
  if (
    model.procedureStatus === "pre_read_open" ||
    model.procedureStatus === "ready_for_review" ||
    model.procedureStatus === "announcement_sent"
  ) {
    return {
      title: "Feedback-Phase offen",
      detail:
        days != null && days >= 0
          ? `Noch ${days} Tage bis Periodenende — Bewertungen zu Stoßrichtungen und Zielen sammeln.`
          : "Vorab-Unterlagen und Stakeholder-Feedback sind aktiv.",
      ctaLabel: "Feedback geben",
    };
  }
  if (model.inLeadWindow) {
    return {
      title: "Review-Fenster offen",
      detail:
        days != null
          ? `Vorlaufzeit ${model.leadTimeDays} Tage — noch ${Math.max(0, days)} Tage bis Periodenende.`
          : `Vorlaufzeit ${model.leadTimeDays} Tage vor Periodenende.`,
      ctaLabel: "Review vorbereiten",
    };
  }
  return {
    title: "Formelles Strategie-Review",
    detail:
      days != null && days > model.leadTimeDays
        ? `Fenster öffnet in ca. ${days - model.leadTimeDays} Tagen (${model.leadTimeDays} Tage vor Periodenende).`
        : `Sammelfenster: ${model.leadTimeDays} Tage vor Periodenende.`,
    ctaLabel: "Review öffnen",
  };
}
