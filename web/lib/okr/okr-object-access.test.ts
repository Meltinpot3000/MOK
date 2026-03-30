import { describe, expect, it } from "vitest";
import {
  canCreateKeyResultOnObjectiveFromBulk,
  canCreateOkrObjective,
  hasKeyResultPermissionForRelation,
  hasObjectivePermissionForRelation,
  keyResultRelationFromBulk,
  objectiveRelationFromBulk,
  strongerAccessRelation,
  type OkrBulkAccessContext,
} from "./okr-object-access";

function ctx(
  codes: string[],
  mid: string,
  reports: [string, string | null][] = []
): OkrBulkAccessContext {
  return {
    permissionCodes: new Set(codes),
    currentMembershipId: mid,
    reportsToByMembershipId: new Map(reports),
  };
}

describe("okr-object-access", () => {
  it("hasObjectivePermissionForRelation: all wins", () => {
    const p = new Set(["okr.objective.update.all"]);
    expect(hasObjectivePermissionForRelation(p, "update", "none")).toBe(true);
  });

  it("hasObjectivePermissionForRelation: own needs owner relation", () => {
    const p = new Set(["okr.objective.update.own"]);
    expect(hasObjectivePermissionForRelation(p, "update", "owner")).toBe(true);
    expect(hasObjectivePermissionForRelation(p, "update", "deputy")).toBe(false);
  });

  it("hasKeyResultPermissionForRelation: department", () => {
    const p = new Set(["okr.key_result.read.department"]);
    expect(hasKeyResultPermissionForRelation(p, "read", "department")).toBe(true);
    expect(hasKeyResultPermissionForRelation(p, "read", "owner")).toBe(false);
  });

  it("objectiveRelationFromBulk: owner deputy department", () => {
    const c = ctx(["okr.objective.read.own"], "u1", [["sub1", "u1"]]);
    expect(objectiveRelationFromBulk(c, { owner_membership_id: "u1", deputy_membership_id: null })).toBe(
      "owner"
    );
    expect(objectiveRelationFromBulk(c, { owner_membership_id: "x", deputy_membership_id: "u1" })).toBe(
      "deputy"
    );
    expect(objectiveRelationFromBulk(c, { owner_membership_id: "sub1", deputy_membership_id: null })).toBe(
      "department"
    );
    expect(objectiveRelationFromBulk(c, { owner_membership_id: "x", deputy_membership_id: null })).toBe("none");
  });

  it("keyResultRelationFromBulk: effective owner and deputy inherit", () => {
    const c = ctx([], "u1", []);
    expect(
      keyResultRelationFromBulk(
        c,
        { owner_membership_id: null, deputy_membership_id: null },
        { owner_membership_id: "u1", deputy_membership_id: null }
      )
    ).toBe("owner");
    expect(
      keyResultRelationFromBulk(
        c,
        { owner_membership_id: null, deputy_membership_id: null },
        { owner_membership_id: "x", deputy_membership_id: "u1" }
      )
    ).toBe("deputy");
  });

  it("keyResultRelationFromBulk: department uses effective owner only", () => {
    const c = ctx([], "mgr", [["sub", "mgr"]]);
    expect(
      keyResultRelationFromBulk(
        c,
        { owner_membership_id: "sub", deputy_membership_id: "other" },
        { owner_membership_id: "x", deputy_membership_id: null }
      )
    ).toBe("department");
  });

  it("strongerAccessRelation priority", () => {
    expect(strongerAccessRelation("owner", "department")).toBe("owner");
    expect(strongerAccessRelation("deputy", "owner")).toBe("owner");
  });

  it("canCreateOkrObjective", () => {
    expect(
      canCreateOkrObjective({
        permissionCodes: new Set(["okr.objective.update.all"]),
        currentMembershipId: "me",
        requestedOwnerMembershipId: null,
      })
    ).toBe(true);
    expect(
      canCreateOkrObjective({
        permissionCodes: new Set(["okr.objective.update.own"]),
        currentMembershipId: "me",
        requestedOwnerMembershipId: "me",
      })
    ).toBe(true);
    expect(
      canCreateOkrObjective({
        permissionCodes: new Set(["okr.objective.update.own"]),
        currentMembershipId: "me",
        requestedOwnerMembershipId: null,
      })
    ).toBe(false);
    expect(
      canCreateOkrObjective({
        permissionCodes: new Set(["okr.objective.update.own"]),
        currentMembershipId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        requestedOwnerMembershipId: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
      })
    ).toBe(true);
  });

  it("canCreateKeyResultOnObjectiveFromBulk", () => {
    const bulkAll = ctx(["okr.key_result.update.all"], "me");
    expect(
      canCreateKeyResultOnObjectiveFromBulk(bulkAll, { owner_membership_id: null, deputy_membership_id: null })
    ).toBe(true);

    const bulkOwn = ctx(["okr.objective.update.own"], "me");
    expect(
      canCreateKeyResultOnObjectiveFromBulk(bulkOwn, { owner_membership_id: "me", deputy_membership_id: null })
    ).toBe(true);
    expect(
      canCreateKeyResultOnObjectiveFromBulk(bulkOwn, { owner_membership_id: "other", deputy_membership_id: null })
    ).toBe(false);
  });

  it("canCreateKeyResultOnObjectiveFromBulk: owner UUID casing matches session", () => {
    const mid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const bulkOwn = ctx(["okr.objective.update.own"], mid);
    expect(
      canCreateKeyResultOnObjectiveFromBulk(bulkOwn, {
        owner_membership_id: "AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE",
        deputy_membership_id: null,
      })
    ).toBe(true);
  });
});
