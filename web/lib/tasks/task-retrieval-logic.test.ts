import { describe, expect, it } from "vitest";

import type { TaskRow } from "@/lib/tasks/approval-queries";
import { normalizeTaskStatus } from "@/lib/tasks/task-status";
import { relationsForTask, isLinkedToOkrSource } from "@/lib/tasks/task-relations";

export const approvalTaskFixture: TaskRow = {
  id: "d52c186f-260a-4cc0-a017-0254c632ffc6",
  organization_id: "15fd7d63-dad1-44c4-9ee5-b3bc34f54e43",
  task_type: "approval",
  title: "Approval: Test OKR 12",
  description: "Test1",
  status: "completed",
  priority: "normal",
  assigned_membership_id: "3b803652-1036-4589-9844-adaf4f16b8db",
  created_by_membership_id: "d6bcc318-a09e-4f4f-ab3a-7f68cb76e6f9",
  source_object_type: "okr_objective",
  source_object_id: "b8ce175c-01c0-48c4-8b7c-d62db0b97a28",
  routing_mode: "direct_manager",
  routing_reason: null,
  due_at: null,
  completed_at: "2026-04-08T13:54:02.280683Z",
  completed_by_membership_id: "3b803652-1036-4589-9844-adaf4f16b8db",
  decision_comment: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function matchesStatusFilter(
  row: TaskRow,
  filter: "open" | "completed" | "all" | "current",
  now: Date
): boolean {
  const n = normalizeTaskStatus(row.status, row.completed_at, row.due_at, now);
  if (filter === "all") return true;
  if (filter === "completed") return n === "completed";
  if (filter === "open") return n === "open" || n === "overdue";
  if (filter === "current") {
    return n === "open" || n === "in_progress" || n === "overdue" || n === "blocked";
  }
  return true;
}

describe("task retrieval logic (fixture)", () => {
  it("normalisiert completed anhand completed_at", () => {
    expect(normalizeTaskStatus("completed", approvalTaskFixture.completed_at, null)).toBe("completed");
  });

  it("OKR-Verknuepfung aus source_object_type", () => {
    expect(isLinkedToOkrSource(approvalTaskFixture.source_object_type)).toBe(true);
  });

  it("assigned + completed_by Membership erkennt Relationen", () => {
    const ids = new Set(["3b803652-1036-4589-9844-adaf4f16b8db"]);
    const rel = relationsForTask(approvalTaskFixture, ids);
    expect(rel).toContain("assigned");
    expect(rel).toContain("completed_by");
  });

  it("completed filter: 1 Treffer", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(matchesStatusFilter(approvalTaskFixture, "completed", now)).toBe(true);
  });

  it("open/current filter: 0 Treffer, completed Task", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(matchesStatusFilter(approvalTaskFixture, "open", now)).toBe(false);
    expect(matchesStatusFilter(approvalTaskFixture, "current", now)).toBe(false);
  });

  it("wrong membership: keine Relation", () => {
    const rel = relationsForTask(approvalTaskFixture, new Set(["00000000-0000-0000-0000-000000000001"]));
    expect(rel).toEqual(["visible"]);
  });
});
