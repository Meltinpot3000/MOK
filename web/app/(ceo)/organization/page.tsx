import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationCreateForm } from "@/components/ceo/OrganizationCreateForm";
import { OrganizationGraphPanel } from "@/components/ceo/OrganizationGraphPanel";
import { OrganizationTabs } from "@/components/ceo/OrganizationTabs";
import { OrganizationUnitTree } from "@/components/ceo/OrganizationUnitTree";
import {
  getOrganizationUnits,
  getOrganizationUnitTypes,
  getPhase0Context,
  getPlanningCycles,
} from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HierarchyNode = {
  id: string;
  parent_id: string | null;
};

function collectDescendants(unitId: string, units: HierarchyNode[]): Set<string> {
  const byParent = new Map<string | null, HierarchyNode[]>();
  for (const unit of units) {
    const key = unit.parent_id ?? null;
    const existing = byParent.get(key) ?? [];
    existing.push(unit);
    byParent.set(key, existing);
  }

  const descendants = new Set<string>();
  const stack = [unitId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const children = byParent.get(current) ?? [];
    for (const child of children) {
      if (!descendants.has(child.id)) {
        descendants.add(child.id);
        stack.push(child.id);
      }
    }
  }

  return descendants;
}

async function requireWriteAccess() {
  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const access = await getSidebarAccessContext("organization");
  if (access.state !== "ok" || !access.canWrite) redirect("/no-access");
  return context;
}

async function validateTypeExists(typeId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("organization_unit_type")
    .select("id")
    .eq("id", typeId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) redirect("/organization");
}

async function validateUniqueCode(organizationId: string, code: string, currentId?: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .schema("app")
    .from("organization_unit")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("code", code.trim());

  const { data } = currentId ? await query.neq("id", currentId).limit(1) : await query.limit(1);
  if ((data ?? []).length > 0) redirect("/organization");
}

export default async function OrganizationPage() {
  const pageAccess = await getSidebarAccessContext("organization");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const [units, unitTypes, cycles] = await Promise.all([
    getOrganizationUnits(context.organizationId),
    getOrganizationUnitTypes(),
    getPlanningCycles(context.organizationId),
  ]);

  async function createOrganizationUnit(formData: FormData) {
    "use server";
    const localContext = await requireWriteAccess();
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const organizationUnitTypeId = String(formData.get("organization_unit_type_id") ?? "").trim();
    const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!name || !code || !organizationUnitTypeId) redirect("/organization");
    await validateTypeExists(organizationUnitTypeId);
    await validateUniqueCode(localContext.organizationId, code);

    const supabase = await createSupabaseServerClient();
    let parentId: string | null = null;
    if (parentIdRaw) {
      const { data: parent } = await supabase
        .schema("app")
        .from("organization_unit")
        .select("id")
        .eq("organization_id", localContext.organizationId)
        .eq("id", parentIdRaw)
        .maybeSingle();
      if (!parent) redirect("/organization");
      parentId = parent.id;
    }

    await supabase.schema("app").from("organization_unit").insert({
      organization_id: localContext.organizationId,
      name,
      code,
      organization_unit_type_id: organizationUnitTypeId,
      parent_id: parentId,
      description: description || null,
      status: "active",
    });

    revalidatePath("/organization");
    revalidatePath("/responsibles");
    redirect("/organization");
  }

  async function updateOrganizationUnit(formData: FormData) {
    "use server";
    const localContext = await requireWriteAccess();
    const id = String(formData.get("id") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const organizationUnitTypeId = String(formData.get("organization_unit_type_id") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!id || !name || !code || !organizationUnitTypeId) redirect("/organization");
    await validateTypeExists(organizationUnitTypeId);
    await validateUniqueCode(localContext.organizationId, code, id);

    const supabase = await createSupabaseServerClient();
    await supabase
      .schema("app")
      .from("organization_unit")
      .update({
        name,
        code,
        organization_unit_type_id: organizationUnitTypeId,
        description: description || null,
      })
      .eq("organization_id", localContext.organizationId)
      .eq("id", id);

    revalidatePath("/organization");
    revalidatePath("/responsibles");
    redirect("/organization");
  }

  async function moveOrganizationUnit(formData: FormData) {
    "use server";
    const localContext = await requireWriteAccess();
    const id = String(formData.get("id") ?? "").trim();
    const parentIdRaw = String(formData.get("parent_id") ?? "").trim();
    if (!id) redirect("/organization");
    if (parentIdRaw === id) redirect("/organization");

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .schema("app")
      .from("organization_unit")
      .select("id, parent_id")
      .eq("organization_id", localContext.organizationId);

    const unitsInOrg = (data ?? []) as HierarchyNode[];
    if (!unitsInOrg.some((unit) => unit.id === id)) redirect("/organization");

    let parentId: string | null = null;
    if (parentIdRaw) {
      if (!unitsInOrg.some((unit) => unit.id === parentIdRaw)) redirect("/organization");
      const descendants = collectDescendants(id, unitsInOrg);
      if (descendants.has(parentIdRaw)) redirect("/organization");
      parentId = parentIdRaw;
    }

    await supabase
      .schema("app")
      .from("organization_unit")
      .update({ parent_id: parentId })
      .eq("organization_id", localContext.organizationId)
      .eq("id", id);

    revalidatePath("/organization");
    revalidatePath("/responsibles");
    redirect("/organization");
  }

  async function archiveOrganizationUnit(formData: FormData) {
    "use server";
    const localContext = await requireWriteAccess();
    const id = String(formData.get("id") ?? "").trim();
    if (!id) redirect("/organization");

    const supabase = await createSupabaseServerClient();
    await supabase
      .schema("app")
      .from("organization_unit")
      .update({ status: "archived" })
      .eq("organization_id", localContext.organizationId)
      .eq("id", id);

    revalidatePath("/organization");
    revalidatePath("/responsibles");
    redirect("/organization");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Aufbauorganisation</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Aufbauorganisation</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Flexible Hierarchie mit frei konfigurierbaren Organisationstypen und Parent-Child-Struktur.
        </p>
      </header>

      <OrganizationTabs />

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Organisationseinheit anlegen</h2>
        {unitTypes.length === 0 ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Keine Organisationstypen verfügbar. Bitte Migrationen anwenden oder
            `SUPABASE_SERVICE_ROLE_KEY` setzen, damit Standardtypen automatisch angelegt werden.
          </p>
        ) : null}
        <OrganizationCreateForm
          units={units}
          unitTypes={unitTypes}
          canWrite={canWrite}
          action={createOrganizationUnit}
        />
      </section>

      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Aufbauorganisation.
        </p>
      ) : null}

      <OrganizationGraphPanel
        organizationId={context.organizationId}
        planningCycleId={cycles[0]?.id ?? null}
      />

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Organisationsstruktur</h2>
        <div className="mt-4">
          <OrganizationUnitTree
            units={units}
            unitTypes={unitTypes}
            canWrite={canWrite}
            updateAction={updateOrganizationUnit}
            createChildAction={createOrganizationUnit}
            moveAction={moveOrganizationUnit}
            archiveAction={archiveOrganizationUnit}
          />
        </div>
      </section>
    </div>
  );
}
