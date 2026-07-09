import { describe, expect, it } from "vitest";
import {
  strategyObjectCanonicalDefinitionText,
  strategyObjectDefinitionHash,
} from "@/lib/strategy-objects/definition-hash";

describe("strategyObjectDefinitionHash", () => {
  it("ist stabil bei gleicher fachlicher Definition", () => {
    const payload = {
      importance_score: 5,
      time_horizon: "2028",
      owner_membership_id: "a5b3d",
      ai_evaluation: {
        objective_score: 4.2,
        status: "ready",
      },
      _hash_excluded: {
        volatile_runtime: "x",
      },
      ignored_runtime_field: "foo",
    };
    const a = strategyObjectDefinitionHash("strategic_objective", "Nordstern", "Skalierung", payload);
    const b = strategyObjectDefinitionHash(
      "strategic_objective",
      " nordstern ",
      " skalierung ",
      {
        ai_evaluation: { status: "ready", objective_score: 4.2 },
        owner_membership_id: "a5b3d",
        time_horizon: "2028",
        importance_score: 5,
        _hash_excluded: { volatile_runtime: "y" },
      }
    );
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("liefert kanonischen Text mit erwarteter Struktur", () => {
    const text = strategyObjectCanonicalDefinitionText("strategic_direction", "Marktausbau", "DACH", {
      priority: 3,
      grouping: "growth",
    });
    expect(text.startsWith("strategic_direction|marktausbau|dach|")).toBe(true);
  });
});
