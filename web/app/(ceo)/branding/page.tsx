import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantBranding } from "@/lib/ceo/queries";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

const BRANDING_LOGO_BUCKET = process.env.BRANDING_LOGO_BUCKET ?? "tenant-branding";
const clampPercent = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;

export default async function BrandingPage() {
  const pageAccess = await getSidebarAccessContext("branding");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const branding = await getTenantBranding(context.organizationId);

  async function saveBranding(formData: FormData) {
    "use server";

    const localContext = await getPhase0Context();
    if (!localContext) redirect("/no-access");
    const localAccess = await getSidebarAccessContext("branding");
    if (localAccess.state !== "ok" || !localAccess.canWrite) redirect("/no-access");

    const primaryColor = String(formData.get("primary_color") ?? "#1D4ED8").trim();
    const secondaryColor = String(formData.get("secondary_color") ?? "#0F172A").trim();
    const accentColor = String(formData.get("accent_color") ?? "#14B8A6").trim();
    const logoFile = formData.get("logo_file");
    const status = String(formData.get("status") ?? "draft").trim() === "published" ? "published" : "draft";
    const qualityImpact = Number(formData.get("quality_weight_impact") ?? 35);
    const qualityCertainty = Number(formData.get("quality_weight_certainty") ?? 25);
    const qualityEvidence = Number(formData.get("quality_weight_evidence") ?? 30);
    const qualityStructure = Number(formData.get("quality_weight_structure") ?? 10);
    const logoRenderMode = String(formData.get("logo_render_mode") ?? "contain").trim() === "cover" ? "cover" : "contain";
    const logoPositionX = clampPercent(Number(formData.get("logo_position_x") ?? 50), 50);
    const logoPositionY = clampPercent(Number(formData.get("logo_position_y") ?? 50), 50);

    const rawWeights = [
      Math.max(0, Number.isFinite(qualityImpact) ? qualityImpact : 35),
      Math.max(0, Number.isFinite(qualityCertainty) ? qualityCertainty : 25),
      Math.max(0, Number.isFinite(qualityEvidence) ? qualityEvidence : 30),
      Math.max(0, Number.isFinite(qualityStructure) ? qualityStructure : 10),
    ];
    const sum = rawWeights.reduce((acc, value) => acc + value, 0) || 100;
    const normalized = {
      impact: rawWeights[0] / sum,
      certainty: rawWeights[1] / sum,
      evidence: rawWeights[2] / sum,
      structure: rawWeights[3] / sum,
    };
    const existingConfig =
      branding?.branding_config && typeof branding.branding_config === "object"
        ? (branding.branding_config as Record<string, unknown>)
        : {};
    const existingLogoStoragePath =
      typeof existingConfig.logo_storage_path === "string" ? existingConfig.logo_storage_path : null;
    const existingLogoStorageBucket =
      typeof existingConfig.logo_storage_bucket === "string" ? existingConfig.logo_storage_bucket : null;
    let resolvedLogoUrl = branding?.logo_url ?? null;
    let resolvedLogoStoragePath = existingLogoStoragePath;
    let resolvedLogoStorageBucket = existingLogoStorageBucket;

    const supabase = await createSupabaseServerClient();
    if (logoFile instanceof File && logoFile.size > 0) {
      const safeFilename = (logoFile.name || "logo")
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const objectPath = `organizations/${localContext.organizationId}/branding/logo-${Date.now()}-${safeFilename || "logo"}`;
      const { error: uploadError } = await supabase.storage
        .from(BRANDING_LOGO_BUCKET)
        .upload(objectPath, logoFile, {
          upsert: true,
          cacheControl: "3600",
          contentType: logoFile.type || undefined,
        });
      if (uploadError) {
        console.error("[branding] logo upload failed", {
          bucket: BRANDING_LOGO_BUCKET,
          objectPath,
          code: uploadError.name,
          message: uploadError.message,
        });
      } else {
        const { data: publicUrlData } = supabase.storage.from(BRANDING_LOGO_BUCKET).getPublicUrl(objectPath);
        resolvedLogoUrl = publicUrlData.publicUrl;
        resolvedLogoStoragePath = objectPath;
        resolvedLogoStorageBucket = BRANDING_LOGO_BUCKET;
      }
    }

    const brandingConfig = {
      ...existingConfig,
      analysis_quality_weights: normalized,
      logo_storage_bucket: resolvedLogoStorageBucket,
      logo_storage_path: resolvedLogoStoragePath,
      logo_render_mode: logoRenderMode,
      logo_position_x: logoPositionX,
      logo_position_y: logoPositionY,
    };

    await supabase
      .schema("app")
      .from("tenant_branding")
      .upsert(
        {
          organization_id: localContext.organizationId,
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          logo_url: resolvedLogoUrl,
          status,
          branding_config: brandingConfig,
          created_by_membership_id: localContext.membershipId,
          updated_by_membership_id: localContext.membershipId,
        },
        { onConflict: "organization_id" }
      );

    revalidatePath("/branding");
    revalidatePath("/dashboard");
    redirect("/branding");
  }

  const preview = {
    primary: branding?.primary_color ?? "#1D4ED8",
    secondary: branding?.secondary_color ?? "#0F172A",
    accent: branding?.accent_color ?? "#14B8A6",
    logo: branding?.logo_url ?? "",
    logoStorage: (() => {
      const config =
        branding?.branding_config && typeof branding.branding_config === "object"
          ? (branding.branding_config as Record<string, unknown>)
          : {};
      return {
        bucket: typeof config.logo_storage_bucket === "string" ? config.logo_storage_bucket : "",
        path: typeof config.logo_storage_path === "string" ? config.logo_storage_path : "",
      };
    })(),
    logoRender: (() => {
      const config =
        branding?.branding_config && typeof branding.branding_config === "object"
          ? (branding.branding_config as Record<string, unknown>)
          : {};
      const mode = config.logo_render_mode === "cover" ? "cover" : "contain";
      const posX = clampPercent(
        typeof config.logo_position_x === "number" ? config.logo_position_x : Number(config.logo_position_x),
        50
      );
      const posY = clampPercent(
        typeof config.logo_position_y === "number" ? config.logo_position_y : Number(config.logo_position_y),
        50
      );
      return { mode, posX, posY };
    })(),
    status: branding?.status ?? "draft",
    qualityWeights: (() => {
      const quality =
        branding?.branding_config &&
        typeof branding.branding_config === "object" &&
        "analysis_quality_weights" in branding.branding_config
          ? (branding.branding_config.analysis_quality_weights as Record<string, unknown>)
          : null;
      const impact = typeof quality?.impact === "number" ? quality.impact : 0.35;
      const certainty = typeof quality?.certainty === "number" ? quality.certainty : 0.25;
      const evidence = typeof quality?.evidence === "number" ? quality.evidence : 0.3;
      const structure = typeof quality?.structure === "number" ? quality.structure : 0.1;
      return {
        impact,
        certainty,
        evidence,
        structure,
      };
    })(),
  };

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Markenauftritt</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Markenauftritt</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Farben und Logo der Organisation zentral verwalten. Die Werte werden mandantenweit gespeichert.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Einstellungen zum Markenauftritt</h2>
          <form action={saveBranding} className="mt-4 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Primaerfarbe</span>
              <input
                name="primary_color"
                defaultValue={preview.primary}
                pattern="^#[0-9A-Fa-f]{6}$"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Sekundaerfarbe</span>
              <input
                name="secondary_color"
                defaultValue={preview.secondary}
                pattern="^#[0-9A-Fa-f]{6}$"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Akzentfarbe</span>
              <input
                name="accent_color"
                defaultValue={preview.accent}
                pattern="^#[0-9A-Fa-f]{6}$"
                required
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Mandantenlogo hochladen (optional)</span>
              <input
                type="file"
                name="logo_file"
                accept="image/*"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Ablage: Bucket <code>{BRANDING_LOGO_BUCKET}</code> unter
                <code> organizations/[tenant-id]/branding/</code>
              </span>
            </label>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-sm font-medium text-zinc-700">Logo-Darstellung in der linken Navigation</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Modus</span>
                  <select
                    name="logo_render_mode"
                    defaultValue={preview.logoRender.mode}
                    className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                  >
                    <option value="contain">Contain (vollstaendig)</option>
                    <option value="cover">Cover (Ausschnitt)</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Fokus X %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="logo_position_x"
                    defaultValue={Math.round(preview.logoRender.posX)}
                    className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Fokus Y %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="logo_position_y"
                    defaultValue={Math.round(preview.logoRender.posY)}
                    className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700">Status</span>
              <select
                name="status"
                defaultValue={preview.status}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="draft">Entwurf</option>
                <option value="published">Veroeffentlicht</option>
              </select>
            </label>

            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="mb-2 text-sm font-medium text-zinc-700">Quality-Score Gewichtung (Strategy Cycle)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Impact %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="quality_weight_impact"
                    defaultValue={Math.round(preview.qualityWeights.impact * 100)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Certainty %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="quality_weight_certainty"
                    defaultValue={Math.round(preview.qualityWeights.certainty * 100)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Evidence %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="quality_weight_evidence"
                    defaultValue={Math.round(preview.qualityWeights.evidence * 100)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-zinc-600">Structure %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    name="quality_weight_structure"
                    defaultValue={Math.round(preview.qualityWeights.structure * 100)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Hinweis: Werte werden automatisch auf 100% normalisiert.
              </p>
            </div>

            <button
              type="submit"
              disabled={!canWrite}
              className="brand-btn px-4 py-2 text-sm"
            >
              Markenauftritt speichern
            </button>
          </form>
        </article>

        <article className="brand-card p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Vorschau</h2>
          <div className="mt-4 rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: preview.primary }} />
              <p className="text-sm font-semibold text-zinc-900">CITADEL Vorschau Markenauftritt</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-md p-3 text-xs text-white" style={{ backgroundColor: preview.primary }}>
                Primaer
              </div>
              <div className="rounded-md p-3 text-xs text-white" style={{ backgroundColor: preview.secondary }}>
                Sekundaer
              </div>
              <div className="rounded-md p-3 text-xs text-white" style={{ backgroundColor: preview.accent }}>
                Akzent
              </div>
            </div>
            <p className="mt-3 text-xs text-zinc-600">
              Status: <span className="brand-accent-badge font-medium">{preview.status}</span>
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              Bewertungsgewichte: I {Math.round(preview.qualityWeights.impact * 100)}% / C{" "}
              {Math.round(preview.qualityWeights.certainty * 100)}% / E{" "}
              {Math.round(preview.qualityWeights.evidence * 100)}% / S{" "}
              {Math.round(preview.qualityWeights.structure * 100)}%
            </p>
            {preview.logo ? (
              <>
                <p className="mt-1 break-all text-xs text-zinc-600">Logo-URL: {preview.logo}</p>
                <div className="mt-2">
                  <p className="text-xs text-zinc-600">
                    Logo-Rendering: {preview.logoRender.mode} ({Math.round(preview.logoRender.posX)}% / {Math.round(preview.logoRender.posY)}%)
                  </p>
                  <div
                    className="mt-1 h-8 w-14 rounded border border-zinc-200 bg-zinc-50"
                    style={{
                      backgroundImage: `url("${preview.logo}")`,
                      backgroundRepeat: "no-repeat",
                      backgroundSize: preview.logoRender.mode,
                      backgroundPosition: `${preview.logoRender.posX}% ${preview.logoRender.posY}%`,
                    }}
                  />
                </div>
                {preview.logoStorage.bucket || preview.logoStorage.path ? (
                  <p className="mt-1 break-all text-xs text-zinc-600">
                    Speicherort: {preview.logoStorage.bucket || "-"} / {preview.logoStorage.path || "-"}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">Kein Logo hinterlegt.</p>
            )}
          </div>
          <p className="mt-4 text-sm text-zinc-600">
            Empfehlung: Markenauftritt als eigenen Admin-Menuepunkt fuehren (wie hier), damit Berechtigungen,
            Audit und CI-Deployment sauber getrennt sind.
          </p>
        </article>
      </section>
      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat nur Leserechte fuer den Markenauftritt.
        </p>
      ) : null}
    </div>
  );
}
