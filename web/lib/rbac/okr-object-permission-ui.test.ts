import { describe, expect, it } from "vitest";
import {
  OKR_OBJECT_DEFAULT_CODES_BY_ROLE,
  OKR_OBJECT_PERMISSION_CODES,
  OKR_OBJECT_PERMISSION_UI_ROWS,
  getOkrObjectDefaultCodesForRoleCode,
} from "./okr-object-permission-ui";

describe("okr-object-permission-ui", () => {
  it("exports exactly 19 permission codes in stable order", () => {
    expect(OKR_OBJECT_PERMISSION_CODES).toHaveLength(19);
    expect(new Set(OKR_OBJECT_PERMISSION_CODES).size).toBe(19);
  });

  it("UI rows match CODE list", () => {
    expect(OKR_OBJECT_PERMISSION_UI_ROWS.map((r) => r.code)).toEqual(OKR_OBJECT_PERMISSION_CODES);
  });

  it("preset matches OKR object + review defaults", () => {
    expect(new Set(OKR_OBJECT_DEFAULT_CODES_BY_ROLE.org_admin)).toEqual(
      new Set([
        "okr.objective.read.all",
        "okr.objective.update.all",
        "okr.key_result.read.all",
        "okr.key_result.update.all",
        "okr.review.workspace.read",
        "okr.review.session.manage",
        "okr.review.facilitator.assign",
      ])
    );
    expect(new Set(OKR_OBJECT_DEFAULT_CODES_BY_ROLE.executive)).toEqual(
      new Set([
        "okr.objective.read.all",
        "okr.key_result.read.all",
        "okr.review.workspace.read",
        "okr.review.facilitator.assign",
      ])
    );
    expect(new Set(OKR_OBJECT_DEFAULT_CODES_BY_ROLE.department_lead)).toEqual(
      new Set([
        "okr.objective.read.department",
        "okr.objective.update.department",
        "okr.key_result.read.department",
        "okr.key_result.update.department",
        "okr.review.workspace.read",
        "okr.review.session.manage",
      ])
    );
    expect(getOkrObjectDefaultCodesForRoleCode("custom_role")).toBeNull();
    expect(getOkrObjectDefaultCodesForRoleCode("team_member")?.length).toBe(9);
  });
});