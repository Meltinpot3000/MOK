import { describe, expect, it } from "vitest";

import { buildSupabaseSessionPoolerUrl, extractSupabaseProjectRef } from "./build-supabase-pooler-url";

describe("buildSupabaseSessionPoolerUrl", () => {
  it("setzt Passwort URL-kodiert und baut Session-Pooler-URL", () => {
    const u = buildSupabaseSessionPoolerUrl({
      supabaseDbPassword: "p@:s/w",
      nextPublicSupabaseUrl: "https://abc-def-123.supabase.co",
      poolerHost: "aws-1-eu-west-1.pooler.supabase.com",
      poolerPort: "5432",
    });
    expect(u).toBe(
      "postgresql://postgres.abc-def-123:p%40%3As%2Fw@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
    );
  });

  it("liefert null ohne Host oder Passwort", () => {
    expect(
      buildSupabaseSessionPoolerUrl({
        supabaseDbPassword: "x",
        nextPublicSupabaseUrl: "https://ref.supabase.co",
        poolerHost: "",
      })
    ).toBeNull();
  });
});

describe("extractSupabaseProjectRef", () => {
  it("liest Project-Ref aus NEXT_PUBLIC_SUPABASE_URL", () => {
    expect(extractSupabaseProjectRef("https://my-project-ref.supabase.co/")).toBe("my-project-ref");
  });

  it("liefert null bei ungueltiger URL", () => {
    expect(extractSupabaseProjectRef("not-a-url")).toBeNull();
  });
});
