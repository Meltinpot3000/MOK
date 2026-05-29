import type { OkrObjectiveView } from "@/lib/okr/okr-cycle-view-model";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";

/** Map → Record nur für KRs, die in den Objective-Views vorkommen (für Client-Passing). */
export function updatesRecordForObjectiveViews(
  objectiveViews: OkrObjectiveView[],
  source: Map<string, OkrUpdateRow[]>
): Record<string, OkrUpdateRow[]> {
  const out: Record<string, OkrUpdateRow[]> = {};
  for (const ov of objectiveViews) {
    for (const kv of ov.keyResults) {
      const id = kv.keyResult.id;
      const list = source.get(id);
      if (list && list.length > 0) {
        out[id] = list.map((row) => ({
          id: row.id,
          progress_value: row.progress_value,
          confidence_level: row.confidence_level,
          created_at: row.created_at,
          comment: row.comment ?? null,
          verification_status: row.verification_status ?? null,
        }));
      }
    }
  }
  return out;
}
