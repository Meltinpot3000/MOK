import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

type PlanningCyclesPageProps = {
  searchParams: Promise<{ scheme?: string; step?: string; error?: string; success?: string; details?: string }>;
};

function readSchemeName(value: unknown): string {
  if (!value) return "-";
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string } | undefined;
    return first?.name ?? "-";
  }
  if (typeof value === "object") {
    const row = value as { name?: string };
    return row.name ?? "-";
  }
  return "-";
}

export default async function PlanningCyclesPage({ searchParams }: PlanningCyclesPageProps) {
  const pageAccess = await getSidebarAccessContext("planning-cycles");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");
  const canWrite = pageAccess.canWrite;
  const params = await searchParams;
  const activeStep = Number(params.step ?? "1");
  const draftSchemeId = String(params.scheme ?? "").trim() || null;
  const statusMessage =
    params.error === "scheme-create-failed"
      ? { type: "error", text: "Schritt 1 konnte nicht gespeichert werden. Bitte Eingaben prüfen." }
      : params.error === "schema-table-missing"
        ? {
            type: "error",
            text: "Die Zyklus-Tabellen fehlen in der Datenbank. Bitte zuerst die neuen Migrationen ausführen.",
          }
        : params.error === "schema-no-permission"
          ? {
              type: "error",
              text: "Keine Berechtigung zum Schreiben auf Zyklus-Tabellen. Bitte RLS/Policies prüfen.",
            }
      : params.error === "scheme-code-exists"
        ? { type: "error", text: "Der Schema-Code existiert bereits. Bitte einen anderen Code wählen." }
      : params.error === "invalid-scheme"
        ? { type: "error", text: "Bitte alle Pflichtfelder für Schritt 1 korrekt ausfüllen." }
        : params.error === "invalid-level-2" || params.error === "divisor-level-2"
          ? { type: "error", text: "Review-Zyklus muss ein ganzzahliger Teiler des Strategiezyklus sein." }
          : params.error === "invalid-level-3" || params.error === "divisor-level-3"
            ? { type: "error", text: "OKR-Zyklus muss ein ganzzahliger Teiler des Review-Zyklus sein." }
            : params.error === "instance-generation-failed"
              ? { type: "error", text: "Instanzen konnten nicht erzeugt werden. Bitte Berechtigungen/Funktionen prüfen." }
            : params.success === "wizard-finished"
              ? { type: "success", text: "Zyklus-Wizard abgeschlossen. Instanzen wurden erzeugt." }
              : params.success === "cutover-scheduled"
              ? { type: "success", text: "Cut-over wurde geplant." }
              : null;

  const supabase = await createSupabaseServerClient();
  const [{ data: schemes }, { data: instances }, { data: cutovers }] = await Promise.all([
    supabase
      .schema("app")
      .from("cycle_schemes")
      .select("id, name, code, is_active, starts_on, top_level_duration_months, max_levels, created_at")
      .eq("organization_id", context.organizationId)
      .order("created_at", { ascending: false }),
    supabase
      .schema("app")
      .from("cycle_instances")
      .select("id, cycle_scheme_id, level_no, code, name, starts_on, ends_on, status")
      .eq("organization_id", context.organizationId)
      .order("starts_on", { ascending: false })
      .limit(120),
    supabase
      .schema("app")
      .from("cycle_cutovers")
      .select(
        "id, from_cycle_scheme_id, to_cycle_scheme_id, cutover_at, status, created_at, from_scheme:from_cycle_scheme_id(name), to_scheme:to_cycle_scheme_id(name)"
      )
      .eq("organization_id", context.organizationId)
      .order("cutover_at", { ascending: false })
      .limit(20),
  ]);
  const schemeIds = (schemes ?? []).map((scheme) => scheme.id);
  const { data: levels } =
    schemeIds.length === 0
      ? { data: [] }
      : await supabase
          .schema("app")
          .from("cycle_scheme_levels")
          .select("id, cycle_scheme_id, level_no, label, duration_months")
          .in("cycle_scheme_id", schemeIds);
  const levelsByScheme = new Map<string, Array<{ level_no: number; label: string; duration_months: number }>>();
  for (const level of levels ?? []) {
    const current = levelsByScheme.get(level.cycle_scheme_id) ?? [];
    current.push({
      level_no: level.level_no,
      label: level.label,
      duration_months: level.duration_months,
    });
    levelsByScheme.set(level.cycle_scheme_id, current);
  }
  for (const [key, value] of levelsByScheme) {
    levelsByScheme.set(
      key,
      value.sort((a, b) => a.level_no - b.level_no)
    );
  }
  const draftScheme = draftSchemeId ? (schemes ?? []).find((scheme) => scheme.id === draftSchemeId) ?? null : null;
  const draftLevels = draftScheme ? levelsByScheme.get(draftScheme.id) ?? [] : [];
  const level1Months = draftLevels.find((level) => level.level_no === 1)?.duration_months ?? null;
  const level2Months = draftLevels.find((level) => level.level_no === 2)?.duration_months ?? null;
  const activeScheme = (schemes ?? []).find((scheme) => scheme.is_active) ?? null;
  const now = new Date();
  const scopedInstances = (instances ?? []).filter((cycle) =>
    activeScheme ? cycle.cycle_scheme_id === activeScheme.id : true
  );
  const orderedInstances = [...scopedInstances].sort(
    (a, b) => new Date(a.starts_on).getTime() - new Date(b.starts_on).getTime()
  );
  const activeInstance =
    orderedInstances.find((cycle) => cycle.status === "active") ??
    orderedInstances.find((cycle) => {
      const start = new Date(cycle.starts_on).getTime();
      const end = new Date(cycle.ends_on).getTime();
      const current = now.getTime();
      return start <= current && current <= end;
    }) ??
    null;
  const nextInstance = orderedInstances.find((cycle) => new Date(cycle.starts_on).getTime() > now.getTime()) ?? null;

  async function createStrategyCycle(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const name = String(formData.get("name") ?? "").trim();
    const code = String(formData.get("code") ?? "").trim();
    const startsOn = String(formData.get("starts_on") ?? "").trim();
    const level1Months = Number(formData.get("level1_months") ?? 36);

    if (!name || !code || !startsOn || !Number.isFinite(level1Months) || level1Months <= 0) {
      redirect("/planning-cycles?error=invalid-scheme");
    }

    const localSupabase = await createSupabaseServerClient();
    const schemeId = crypto.randomUUID();
    let { error: insertSchemeError } = await localSupabase
      .schema("app")
      .from("cycle_schemes")
      .insert({
        id: schemeId,
        organization_id: localContext.organizationId,
        name,
        code,
        starts_on: startsOn,
        top_level_duration_months: level1Months,
        max_levels: 1,
        is_active: false,
        created_by_membership_id: localContext.membershipId,
      });

    if (insertSchemeError?.code === "23505") {
      redirect("/planning-cycles?error=scheme-code-exists");
    }
    const insertSchemeCode = String(insertSchemeError?.code ?? "").toUpperCase();
    if (insertSchemeCode === "42P01" || insertSchemeCode === "PGRST205") {
      redirect("/planning-cycles?error=schema-table-missing");
    }
    if (insertSchemeError?.code === "42501") {
      redirect("/planning-cycles?error=schema-no-permission");
    }
    if (insertSchemeError) {
      console.error("createStrategyCycle insert cycle_schemes failed", {
        code: insertSchemeError.code,
        message: insertSchemeError.message,
        details: insertSchemeError.details,
      });
      const admin = createSupabaseAdminClient();
      if (admin) {
        const fallback = await admin.schema("app").from("cycle_schemes").insert({
          id: schemeId,
          organization_id: localContext.organizationId,
          name,
          code,
          starts_on: startsOn,
          top_level_duration_months: level1Months,
          max_levels: 1,
          is_active: false,
          created_by_membership_id: localContext.membershipId,
        });
        insertSchemeError = fallback.error;
      }
    }
    if (insertSchemeError?.code === "23505") {
      redirect("/planning-cycles?error=scheme-code-exists");
    }
    const fallbackSchemeCode = String(insertSchemeError?.code ?? "").toUpperCase();
    if (fallbackSchemeCode === "42P01" || fallbackSchemeCode === "PGRST205") {
      redirect("/planning-cycles?error=schema-table-missing");
    }
    if (insertSchemeError?.code === "42501") {
      redirect("/planning-cycles?error=schema-no-permission");
    }
    if (insertSchemeError) redirect("/planning-cycles?error=scheme-create-failed");

    let { error: insertLevelError } = await localSupabase.schema("app").from("cycle_scheme_levels").insert([
      {
        cycle_scheme_id: schemeId,
        level_no: 1,
        label: "Strategiezyklus",
        duration_months: level1Months,
      },
    ]);
    if (insertLevelError) {
      console.error("createStrategyCycle insert cycle_scheme_levels failed", {
        code: insertLevelError.code,
        message: insertLevelError.message,
        details: insertLevelError.details,
      });
      const admin = createSupabaseAdminClient();
      if (admin) {
        const fallback = await admin.schema("app").from("cycle_scheme_levels").insert([
          {
            cycle_scheme_id: schemeId,
            level_no: 1,
            label: "Strategiezyklus",
            duration_months: level1Months,
          },
        ]);
        insertLevelError = fallback.error;
      }
    }
    const insertLevelCode = String(insertLevelError?.code ?? "").toUpperCase();
    if (insertLevelCode === "42P01" || insertLevelCode === "PGRST205") {
      redirect("/planning-cycles?error=schema-table-missing");
    }
    if (insertLevelError?.code === "42501") {
      redirect("/planning-cycles?error=schema-no-permission");
    }
    if (insertLevelError) redirect("/planning-cycles?error=scheme-create-failed");

    revalidatePath("/planning-cycles");
    redirect(`/planning-cycles?scheme=${schemeId}&step=2`);
  }

  async function saveReviewCycle(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const schemeId = String(formData.get("scheme_id") ?? "").trim();
    const level1Months = Number(formData.get("level1_months") ?? 0);
    const level2Months = Number(formData.get("level2_months") ?? 12);
    if (!schemeId) redirect("/planning-cycles");
    if (!Number.isFinite(level1Months) || !Number.isFinite(level2Months) || level2Months <= 0) {
      redirect(`/planning-cycles?scheme=${schemeId}&step=2&error=invalid-level-2`);
    }
    if (level1Months % level2Months !== 0) {
      redirect(`/planning-cycles?scheme=${schemeId}&step=2&error=divisor-level-2`);
    }

    const localSupabase = await createSupabaseServerClient();
    await localSupabase.schema("app").from("cycle_scheme_levels").upsert(
      {
        cycle_scheme_id: schemeId,
        level_no: 2,
        label: "Review-Zyklus",
        duration_months: level2Months,
        divisor_of_parent: level1Months / level2Months,
      },
      { onConflict: "cycle_scheme_id,level_no" }
    );
    await localSupabase
      .schema("app")
      .from("cycle_schemes")
      .update({ max_levels: 2 })
      .eq("organization_id", localContext.organizationId)
      .eq("id", schemeId);

    revalidatePath("/planning-cycles");
    redirect(`/planning-cycles?scheme=${schemeId}&step=3`);
  }

  async function saveOkrCycle(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const schemeId = String(formData.get("scheme_id") ?? "").trim();
    const level1Months = Number(formData.get("level1_months") ?? 0);
    const level2Months = Number(formData.get("level2_months") ?? 0);
    const level3Months = Number(formData.get("level3_months") ?? 3);
    if (!schemeId) redirect("/planning-cycles");
    if (
      !Number.isFinite(level1Months) ||
      !Number.isFinite(level2Months) ||
      !Number.isFinite(level3Months) ||
      level2Months <= 0 ||
      level3Months <= 0
    ) {
      redirect(`/planning-cycles?scheme=${schemeId}&step=3&error=invalid-level-3`);
    }
    if (level1Months % level2Months !== 0 || level2Months % level3Months !== 0) {
      redirect(`/planning-cycles?scheme=${schemeId}&step=3&error=divisor-level-3`);
    }

    const localSupabase = await createSupabaseServerClient();
    await localSupabase.schema("app").from("cycle_scheme_levels").upsert(
      {
        cycle_scheme_id: schemeId,
        level_no: 3,
        label: "OKR-Zyklus",
        duration_months: level3Months,
        divisor_of_parent: level2Months / level3Months,
      },
      { onConflict: "cycle_scheme_id,level_no" }
    );
    await localSupabase
      .schema("app")
      .from("cycle_schemes")
      .update({ max_levels: 3 })
      .eq("organization_id", localContext.organizationId)
      .eq("id", schemeId);

    let { error: generateInstancesError } = await localSupabase.rpc("generate_cycle_instances_for_scheme", {
      p_cycle_scheme_id: schemeId,
      p_horizon_months: level1Months * 2,
      p_actor_membership_id: localContext.membershipId,
    });
    if (generateInstancesError) {
      console.error("saveOkrCycle generate_cycle_instances_for_scheme failed", {
        code: generateInstancesError.code,
        message: generateInstancesError.message,
        details: generateInstancesError.details,
      });
      const admin = createSupabaseAdminClient();
      if (admin) {
        const fallback = await admin.rpc("generate_cycle_instances_for_scheme", {
          p_cycle_scheme_id: schemeId,
          p_horizon_months: level1Months * 2,
          p_actor_membership_id: localContext.membershipId,
        });
        generateInstancesError = fallback.error;
      }
    }
    if (generateInstancesError?.code === "42501") {
      redirect(`/planning-cycles?scheme=${schemeId}&step=3&error=schema-no-permission`);
    }
    if (generateInstancesError) {
      redirect(`/planning-cycles?scheme=${schemeId}&step=3&error=instance-generation-failed`);
    }

    revalidatePath("/planning-cycles");
    redirect("/planning-cycles?success=wizard-finished");
  }

  async function activateScheme(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const schemeId = String(formData.get("scheme_id") ?? "");
    if (!schemeId) redirect("/planning-cycles");

    const localSupabase = await createSupabaseServerClient();
    await localSupabase
      .schema("app")
      .from("cycle_schemes")
      .update({ is_active: false })
      .eq("organization_id", localContext.organizationId);

    await localSupabase
      .schema("app")
      .from("cycle_schemes")
      .update({ is_active: true })
      .eq("organization_id", localContext.organizationId)
      .eq("id", schemeId);

    revalidatePath("/planning-cycles");
    revalidatePath("/dashboard");
    redirect("/planning-cycles");
  }

  async function scheduleCutover(formData: FormData) {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const fromSchemeId = String(formData.get("from_scheme_id") ?? "").trim();
    const toSchemeId = String(formData.get("to_scheme_id") ?? "").trim();
    const cutoverDate = String(formData.get("cutover_date") ?? "").trim();
    if (!fromSchemeId || !toSchemeId || !cutoverDate) redirect("/planning-cycles");

    const localSupabase = await createSupabaseServerClient();
    await localSupabase.schema("app").from("cycle_cutovers").insert({
      organization_id: localContext.organizationId,
      from_cycle_scheme_id: fromSchemeId,
      to_cycle_scheme_id: toSchemeId,
      cutover_at: `${cutoverDate}T00:00:00.000Z`,
      status: "scheduled",
      created_by_membership_id: localContext.membershipId,
    });

    revalidatePath("/planning-cycles");
    redirect("/planning-cycles?success=cutover-scheduled");
  }

  async function executeDueCutovers() {
    "use server";
    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("planning-cycles");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");
    const localSupabase = await createSupabaseServerClient();
    await localSupabase.rpc("execute_due_cycle_cutovers");
    revalidatePath("/planning-cycles");
    revalidatePath("/dashboard");
    redirect("/planning-cycles");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Systemkonfiguration</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Verwaltung der Planungszyklen</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Stabiler Zyklusbetrieb mit geführter 3-Schritt-Erfassung und optionalem Cut-over auf ein neues
          Schema.
        </p>
      </header>

      {statusMessage ? (
        <p
          className={`rounded-md border p-3 text-sm ${
            statusMessage.type === "error"
              ? "border-red-300 bg-red-50 text-red-800"
              : "border-emerald-300 bg-emerald-50 text-emerald-800"
          }`}
        >
          {statusMessage.text}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Schritt 1: Strategiezyklus</h2>
          <form action={createStrategyCycle} className="mt-4 space-y-3">
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Schema-Code</span>
              <input
                name="code"
                required
                placeholder="z. B. SCHEME-CORE"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Schema-Name</span>
              <input
                name="name"
                required
                placeholder="z. B. Strategie/Jahr/OKR"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Startdatum des Schemas</span>
              <input
                type="date"
                name="starts_on"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Strategiezyklus (L1) in Monaten</span>
              <input
                type="number"
                name="level1_months"
                required
                min={1}
                defaultValue={36}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Schritt 1 speichern
            </button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Schritt 2: Review-Zyklus</h2>
          {!draftScheme || activeStep < 2 ? (
            <p className="mt-4 text-sm text-zinc-600">Bitte zuerst Schritt 1 anlegen.</p>
          ) : (
            <form action={saveReviewCycle} className="mt-4 space-y-3">
              <input type="hidden" name="scheme_id" value={draftScheme.id} />
              <input type="hidden" name="level1_months" value={String(level1Months ?? "")} />
              <p className="text-xs text-zinc-500">
                Aktives Schema im Wizard: {draftScheme.name} ({draftScheme.code})
              </p>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Review-Zyklus (L2) in Monaten</span>
                <input
                  type="number"
                  name="level2_months"
                  required
                  min={1}
                  defaultValue={12}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={!canWrite}
                className="brand-btn px-4 py-2 text-sm"
              >
                Schritt 2 speichern
              </button>
            </form>
          )}
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Schritt 3: OKR-Zyklus</h2>
          {!draftScheme || activeStep < 3 ? (
            <p className="mt-4 text-sm text-zinc-600">Bitte zuerst Schritt 1 und 2 speichern.</p>
          ) : (
            <form action={saveOkrCycle} className="mt-4 space-y-3">
              <input type="hidden" name="scheme_id" value={draftScheme.id} />
              <input type="hidden" name="level1_months" value={String(level1Months ?? "")} />
              <input type="hidden" name="level2_months" value={String(level2Months ?? "")} />
              <p className="text-xs text-zinc-500">
                Aktives Schema im Wizard: {draftScheme.name} ({draftScheme.code})
              </p>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">OKR-Zyklus (L3) in Monaten</span>
                <input
                  type="number"
                  name="level3_months"
                  required
                  min={1}
                  defaultValue={3}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                Schritt 3 speichern und Instanzen erzeugen
              </button>
            </form>
          )}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Aktives Schema setzen</h2>
          <div className="mt-4 space-y-3">
            {(schemes ?? []).map((scheme) => (
              <form key={scheme.id} action={activateScheme} className="brand-surface space-y-2 p-3">
                <input type="hidden" name="scheme_id" value={scheme.id} />
                <p className="text-sm font-semibold text-zinc-900">
                  {scheme.name} ({scheme.code})
                </p>
                <p className="text-xs text-zinc-600">
                  Start: {scheme.starts_on} | Top-Level: {scheme.top_level_duration_months} Monate | Max
                  Levels: {scheme.max_levels}
                </p>
                <button
                  type="submit"
                  disabled={!canWrite || scheme.is_active}
                  className="brand-btn-secondary px-3 py-1.5 text-xs"
                >
                  {scheme.is_active ? "Aktiv" : "Als aktiv setzen"}
                </button>
              </form>
            ))}
          </div>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Cut-over planen</h2>
          <form action={scheduleCutover} className="mt-4 space-y-3">
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Altes Schema</span>
              <select
                name="from_scheme_id"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Schema auswählen</option>
                {(schemes ?? []).map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.code} - {scheme.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Neues Schema</span>
              <select
                name="to_scheme_id"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">Schema auswählen</option>
                {(schemes ?? []).map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {scheme.code} - {scheme.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-700">
              <span className="mb-1 block font-medium">Cut-over Datum</span>
              <input
                type="date"
                name="cutover_date"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
              Cut-over planen
            </button>
          </form>
          <form action={executeDueCutovers} className="mt-3">
            <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-4 py-2 text-sm">
              Fällige Cut-overs ausführen
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {(cutovers ?? []).map((cutover) => (
              <div key={cutover.id} className="rounded-md border border-zinc-200 px-3 py-2 text-xs text-zinc-700">
                {readSchemeName(cutover.from_scheme)} → {readSchemeName(cutover.to_scheme)} |{" "}
                {new Date(cutover.cutover_at).toLocaleDateString("de-CH")} | {cutover.status}
              </div>
            ))}
          </div>
        </article>
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte für Planungszyklen.
        </p>
      ) : null}

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Aktive und naechste Periode</h2>
        <p className="mt-1 text-xs text-zinc-500">
          {activeScheme
            ? `Anzeige fuer aktives Schema: ${activeScheme.name} (${activeScheme.code})`
            : "Kein aktives Schema gesetzt."}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="brand-surface rounded-md p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Aktive Periode</p>
            {activeInstance ? (
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p className="font-medium">
                  {activeInstance.code} - {activeInstance.name}
                </p>
                <p>
                  Zeitraum: {activeInstance.starts_on} bis {activeInstance.ends_on}
                </p>
                <p>
                  Level: L{activeInstance.level_no} | Status: {activeInstance.status}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">Keine aktive Periode gefunden.</p>
            )}
          </div>
          <div className="brand-surface rounded-md p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Naechste Periode</p>
            {nextInstance ? (
              <div className="mt-2 space-y-1 text-sm text-zinc-800">
                <p className="font-medium">
                  {nextInstance.code} - {nextInstance.name}
                </p>
                <p>
                  Zeitraum: {nextInstance.starts_on} bis {nextInstance.ends_on}
                </p>
                <p>
                  Level: L{nextInstance.level_no} | Status: {nextInstance.status}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">Keine naechste Periode geplant.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
