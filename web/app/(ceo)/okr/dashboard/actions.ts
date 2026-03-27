"use server";

import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
import { getOkrCycleContext } from "@/lib/okr/okr-cycle-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export type OkrKpiDetailKey =
  | "objectives"
  | "keyResults"
  | "status"
  | "critical"
  | "krNoInit"
  | "initNoKr";

export type OkrKpiDetailSection = { heading: string; lines: string[] };

export async function fetchOkrDashboardKpiDetailAction(
  okrCycleId: string,
  kpiKey: OkrKpiDetailKey
): Promise<
  | { ok: true; title: string; sections: OkrKpiDetailSection[] }
  | { ok: false; error: string }
> {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") return { ok: false, error: "Nicht angemeldet." };
  if (pageAccess.state === "forbidden") return { ok: false, error: "Kein Zugriff." };

  const context = await getPhase0Context();
  if (!context) return { ok: false, error: "Kein Kontext." };
  const cycle = await getActivePlanningCycle(context.organizationId);
  if (!cycle) return { ok: false, error: "Kein Planungszyklus." };

  const ctx = await getOkrCycleContext(context.organizationId, cycle.id, okrCycleId.trim());
  const selected = ctx.workspace.selectedOkrCycleId;
  if (!selected || selected !== okrCycleId.trim()) {
    return { ok: false, error: "Zeitraum nicht gefunden oder nicht ausgewählt." };
  }

  const { objectiveViews, workspace } = ctx;
  const initiativeIdsWithoutKr = ctx.initiativeIdsWithoutKr;
  const now = Date.now();

  const statusDe: Record<string, string> = {
    on_track: "im Plan",
    at_risk: "wackelig",
    off_track: "kritisch",
  };

  switch (kpiKey) {
    case "objectives": {
      const lines = objectiveViews.map(
        (ov) =>
          `${ov.objective.title} · Owner ${ov.objective.ownerDisplayName ?? "—"} · ${Math.round(ov.rollupProgressPercent)}% · ${statusDe[ov.rollupStatus] ?? ov.rollupStatus}`
      );
      return {
        ok: true,
        title: "OKR-Objectives",
        sections: [{ heading: `Alle Objectives (${lines.length})`, lines }],
      };
    }
    case "keyResults": {
      const lines: string[] = [];
      for (const ov of objectiveViews) {
        for (const kv of ov.keyResults) {
          lines.push(
            `${kv.keyResult.title} · Objective „${ov.objective.title}“ · ${Math.round(kv.progress)}% · ${statusDe[kv.reviewStatus] ?? kv.reviewStatus}`
          );
        }
      }
      return {
        ok: true,
        title: "Key Results",
        sections: [{ heading: `Alle Key Results (${lines.length})`, lines }],
      };
    }
    case "status": {
      const on: string[] = [];
      const risk: string[] = [];
      const off: string[] = [];
      for (const ov of objectiveViews) {
        for (const kv of ov.keyResults) {
          const line = `${kv.keyResult.title} · „${ov.objective.title}“`;
          if (kv.reviewStatus === "on_track") on.push(line);
          else if (kv.reviewStatus === "at_risk") risk.push(line);
          else off.push(line);
        }
      }
      return {
        ok: true,
        title: "KR-Status im Überblick",
        sections: [
          { heading: `Im Plan (${on.length})`, lines: on },
          { heading: `Wackelig (${risk.length})`, lines: risk },
          { heading: `Kritisch (${off.length})`, lines: off },
        ],
      };
    }
    case "critical": {
      const lines: string[] = [];
      for (const ov of objectiveViews) {
        for (const kv of ov.keyResults) {
          const due = kv.keyResult.dueDate ? Date.parse(kv.keyResult.dueDate) : NaN;
          const overdue =
            !Number.isNaN(due) && due < now && kv.keyResult.status !== "completed";
          if (kv.reviewStatus === "off_track" || (kv.reviewStatus === "at_risk" && overdue)) {
            const bits = [
              kv.keyResult.title,
              `„${ov.objective.title}“`,
              statusDe[kv.reviewStatus] ?? kv.reviewStatus,
            ];
            if (overdue) bits.push("überfällig");
            lines.push(bits.join(" · "));
          }
        }
      }
      return {
        ok: true,
        title: "Kritische / überfällig wackelige KRs",
        sections: [{ heading: `Treffer (${lines.length})`, lines }],
      };
    }
    case "krNoInit": {
      const lines: string[] = [];
      for (const ov of objectiveViews) {
        for (const kv of ov.keyResults) {
          if (kv.keyResult.warningNoInitiativeLink) {
            lines.push(`${kv.keyResult.title} · „${ov.objective.title}“`);
          }
        }
      }
      return {
        ok: true,
        title: "Key Results ohne Initiative",
        sections: [{ heading: `Ohne Verknüpfung (${lines.length})`, lines }],
      };
    }
    case "initNoKr": {
      const lines = initiativeIdsWithoutKr
        .map((id) => {
          const row = workspace.initiatives.find((i) => i.id === id);
          return row?.title ? `„${row.title}“` : id;
        })
        .filter(Boolean) as string[];
      return {
        ok: true,
        title: "Initiativen ohne Key Result",
        sections: [{ heading: `Nicht verknüpft (${lines.length})`, lines }],
      };
    }
    default:
      return { ok: false, error: "Unbekannte Kennzahl." };
  }
}
