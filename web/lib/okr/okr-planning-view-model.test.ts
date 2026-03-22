import { describe, expect, it } from "vitest";
import {
  initiativeIdsByKeyResultId,
  initiativeWarningNoKeyResultLink,
  keyResultIdsByInitiativeId,
  keyResultWarningNoInitiativeLink,
  type InitiativeKrLinkRow,
} from "./okr-planning-view-model";

const sample: InitiativeKrLinkRow[] = [
  { initiative_id: "i1", key_result_id: "k1" },
  { initiative_id: "i1", key_result_id: "k2" },
  { initiative_id: "i2", key_result_id: "k1" },
];

describe("okr-planning-view-model", () => {
  it("keyResultIdsByInitiativeId groups by initiative", () => {
    const m = keyResultIdsByInitiativeId(sample);
    expect(m.get("i1")?.sort()).toEqual(["k1", "k2"].sort());
    expect(m.get("i2")).toEqual(["k1"]);
  });

  it("initiativeIdsByKeyResultId groups by key result", () => {
    const m = initiativeIdsByKeyResultId(sample);
    expect(m.get("k1")?.sort()).toEqual(["i1", "i2"].sort());
    expect(m.get("k2")).toEqual(["i1"]);
  });

  it("initiativeWarningNoKeyResultLink", () => {
    expect(initiativeWarningNoKeyResultLink("i1", sample)).toBe(false);
    expect(initiativeWarningNoKeyResultLink("i99", sample)).toBe(true);
  });

  it("keyResultWarningNoInitiativeLink", () => {
    expect(keyResultWarningNoInitiativeLink("k1", sample)).toBe(false);
    expect(keyResultWarningNoInitiativeLink("k99", sample)).toBe(true);
  });
});
