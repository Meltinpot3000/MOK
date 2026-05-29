import { describe, expect, it } from "vitest";
import {
  buildPlannedUnits,
} from "@/lib/directory-sync/build-diff";
import { entraAttributeExternalId, entraUnitCode, splitAttributePath } from "@/lib/directory-sync/slug";
import type { DirectoryConnectionRow, EntraGraphUser } from "@/lib/directory-sync/types";

describe("directory-sync slug", () => {
  it("splits attribute paths", () => {
    expect(splitAttributePath("Sales / EMEA", "/")).toEqual(["Sales", "EMEA"]);
    expect(splitAttributePath("Flat", null)).toEqual(["Flat"]);
  });

  it("builds stable unit codes", () => {
    expect(entraUnitCode("Sales|EMEA")).toMatch(/^entra-dept-/);
    expect(entraAttributeExternalId("Sales|EMEA")).toMatch(/^attr:/);
  });

  it("builds hierarchical planned units", () => {
    const connection = {
      organization_id: "org",
      department_path_separator: "/",
      attribute_priority: ["department"],
    } as DirectoryConnectionRow;

    const users: EntraGraphUser[] = [
      {
        id: "u1",
        mail: "a@example.com",
        userPrincipalName: null,
        displayName: "A",
        jobTitle: null,
        department: "Sales / EMEA",
        officeLocation: null,
        companyName: null,
        accountEnabled: true,
        managerId: null,
      },
    ];

    const planned = buildPlannedUnits(users, connection);
    expect(planned.size).toBe(2);
    const sales = [...planned.values()].find((u) => u.name === "Sales");
    const emea = [...planned.values()].find((u) => u.name === "EMEA");
    expect(sales?.parentExternalId).toBeNull();
    expect(emea?.parentExternalId).toBe(sales?.externalId);
  });
});
