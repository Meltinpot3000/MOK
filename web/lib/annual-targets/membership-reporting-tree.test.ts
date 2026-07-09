import { describe, expect, it } from "vitest";
import {
  collectAncestorMembershipIds,
  collectDescendantMembershipIds,
} from "@/lib/annual-targets/membership-reporting-tree";

describe("collectDescendantMembershipIds", () => {
  const tree = [
    { id: "ceo", reportsToMembershipId: null },
    { id: "vp", reportsToMembershipId: "ceo" },
    { id: "lead", reportsToMembershipId: "vp" },
    { id: "ic", reportsToMembershipId: "lead" },
    { id: "peer", reportsToMembershipId: "ceo" },
  ];

  it("sammelt alle Ebenen unter der Führungskraft", () => {
    const fromVp = collectDescendantMembershipIds("vp", tree);
    expect(fromVp).toEqual(new Set(["lead", "ic"]));
  });

  it("schließt die Führungskraft selbst aus", () => {
    const fromVp = collectDescendantMembershipIds("vp", tree);
    expect(fromVp.has("vp")).toBe(false);
  });

  it("schließt parallele Äste aus", () => {
    const fromVp = collectDescendantMembershipIds("vp", tree);
    expect(fromVp.has("peer")).toBe(false);
  });

  it("liefert leeres Set ohne Unterstellte", () => {
    expect(collectDescendantMembershipIds("ic", tree).size).toBe(0);
  });

  it("sammelt Vorgesetzte bis zur Wurzel", () => {
    expect(collectAncestorMembershipIds("ic", tree)).toEqual(new Set(["lead", "vp", "ceo"]));
  });
});
