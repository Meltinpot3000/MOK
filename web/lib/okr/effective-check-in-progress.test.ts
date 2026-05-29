import { describe, expect, it } from "vitest";
import {
  effectiveProgressFromCheckIns,
  hasPendingHundredCheckIn,
  isOkrUpdateEffectiveForProgress,
  verificationStatusLabelDe,
} from "./effective-check-in-progress";
import type { OkrUpdateRow } from "@/lib/review/key-result-progress";

describe("effective-check-in-progress", () => {
  it("isOkrUpdateEffectiveForProgress", () => {
    expect(isOkrUpdateEffectiveForProgress(null)).toBe(true);
    expect(isOkrUpdateEffectiveForProgress("confirmed")).toBe(true);
    expect(isOkrUpdateEffectiveForProgress("pending")).toBe(false);
    expect(isOkrUpdateEffectiveForProgress("rejected")).toBe(false);
  });

  it("effectiveProgressFromCheckIns skips pending 100%", () => {
    const updates: OkrUpdateRow[] = [
      {
        progress_value: 100,
        created_at: "2026-05-02T00:00:00Z",
        verification_status: "pending",
      },
      {
        progress_value: 70,
        created_at: "2026-05-01T00:00:00Z",
        verification_status: "confirmed",
      },
    ];
    expect(effectiveProgressFromCheckIns(updates, 0)).toBe(70);
  });

  it("hasPendingHundredCheckIn", () => {
    expect(
      hasPendingHundredCheckIn([
        { progress_value: 100, created_at: "x", verification_status: "pending" },
      ])
    ).toBe(true);
    expect(
      hasPendingHundredCheckIn([
        { progress_value: 80, created_at: "x", verification_status: "pending" },
      ])
    ).toBe(false);
  });

  it("verificationStatusLabelDe", () => {
    expect(verificationStatusLabelDe("rejected", 100)).toContain("abgelehnt");
    expect(verificationStatusLabelDe("pending", 100)).toContain("ausstehend");
  });
});
