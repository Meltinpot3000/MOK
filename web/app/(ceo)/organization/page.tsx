import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context, getOrgUnits } from "@/lib/phase0/queries";

export default async function OrganizationPage() {
  const context = await getPhase0Context();
  if (!context) {
    redirect("/no-access");
  }

  const orgUnits = await getOrgUnits(context.organizationId);

  async function createOrgUnit(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) {
      redirect("/no-access");
    }

    const levelNo = Number(formData.get("level_no"));
    const unitType = String(formData.get("unit_type"));
    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const parent = String(formData.get("parent_unit_id") ?? "").trim();

    const supabase = await createSupabaseServerClient();
    await supabase.schema("app").from("org_units").insert({
      organization_id: localContext.organizationId,
      level_no: levelNo,
      unit_type: unitType,
      code,
      name,
      parent_unit_id: parent.length > 0 ? parent : null,
      owner_membership_id: localContext.membershipId,
    });

    revalidatePath("/organization");
    redirect("/organization");
  }

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Phase 0 Fundament
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Organisationsteile</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Drei Ebenen: Organisation {"->"} Bereich {"->"} Team. Eltern-Kind-Struktur ist technisch
          validiert.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Organisationsteil anlegen</h2>
        <form action={createOrgUnit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            name="code"
            required
            placeholder="Code (z. B. DIV-SALES)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <input
            name="name"
            required
            placeholder="Name (z. B. Sales)"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <select name="level_no" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="1">Level 1 - Organisation</option>
            <option value="2">Level 2 - Bereich</option>
            <option value="3">Level 3 - Team</option>
          </select>
          <select name="unit_type" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="organization">organization</option>
            <option value="division">division</option>
            <option value="team">team</option>
          </select>
          <select
            name="parent_unit_id"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm md:col-span-2"
          >
            <option value="">Kein Parent (nur für Level 1)</option>
            {orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.code} - {unit.name} (L{unit.level_no})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 md:col-span-2"
          >
            Organisationsteil speichern
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Strukturübersicht</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2">Level</th>
                <th className="py-2">Code</th>
                <th className="py-2">Name</th>
                <th className="py-2">Typ</th>
                <th className="py-2">Parent</th>
              </tr>
            </thead>
            <tbody>
              {orgUnits.map((unit) => (
                <tr key={unit.id} className="border-b border-zinc-100">
                  <td className="py-2">{unit.level_no}</td>
                  <td className="py-2">{unit.code}</td>
                  <td className="py-2">{unit.name}</td>
                  <td className="py-2">{unit.unit_type}</td>
                  <td className="py-2">{unit.parent_unit_id ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orgUnits.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Noch keine Organisationsteile angelegt.</p>
        ) : null}
      </section>
    </div>
  );
}
