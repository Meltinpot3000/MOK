import { describe, expect, it } from "vitest";

import { describePostgresConnectionString } from "./resolve-database-url";

describe("describePostgresConnectionString", () => {
  it("parst Host/Port/DB/User ohne Passwort-Leck", () => {
    const d = describePostgresConnectionString(
      "postgresql://postgres.myref:secret%40pass@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"
    );
    expect(d.host).toBe("aws-1-eu-west-1.pooler.supabase.com");
    expect(d.port).toBe("5432");
    expect(d.database).toBe("postgres");
    expect(d.user).toBe("postgres.myref");
  });
});
