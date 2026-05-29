import {
  saveCompanyKennzahlen,
  saveStrategyReferenceText,
} from "@/app/(ceo)/strategy-cycle/actions";
import type { StrategicContextOutput } from "@/lib/analysis-network/objective-evaluation-providers";
import type { CompanyKennzahlen } from "@/lib/strategy-cycle/company-info";
import {
  INDUSTRIE_OPTIONS,
  KERN_WERTSCHOEPFUNG_OPTIONS,
  MARKTREGIONEN_OPTIONS,
  ORGFORM_OPTIONS,
  TRANSFORMATION_STATUS_OPTIONS,
  UNTERNEHMENSGROESSE_OPTIONS,
} from "@/lib/strategy-cycle/company-info";
import type { StrategyReferenceFields } from "@/lib/strategy-cycle/strategy-reference";
import {
  getUnternehmensinfoSubTabLabel,
  UNTERNEHMENSINFO_TABS,
  formatStrategyCycleTimestampUtc,
  type UnternehmensinfoTab,
} from "@/lib/company-info/unternehmensinfo-ui";

export type UnternehmensinfoStrategicContextCache = {
  parsed: StrategicContextOutput | null;
  provider: string | null;
  model: string | null;
  prompt_version: string | null;
  created_at: string | null;
} | null;

type UnternehmensinfoSectionProps = {
  activeTab: UnternehmensinfoTab;
  canWrite: boolean;
  companyKennzahlen: CompanyKennzahlen;
  strategyReferenceFields: StrategyReferenceFields;
  strategicContextCache: UnternehmensinfoStrategicContextCache;
};

export function UnternehmensinfoSection({
  activeTab,
  canWrite,
  companyKennzahlen,
  strategyReferenceFields,
  strategicContextCache,
}: UnternehmensinfoSectionProps) {
  return (
    <>
      <section className="brand-card p-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {UNTERNEHMENSINFO_TABS.map((tab) => (
            <a
              key={tab}
              href={`/unternehmensinfo?l2=${tab}`}
              className={`rounded-md border px-3 py-1.5 text-xs ${
                activeTab === tab
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {getUnternehmensinfoSubTabLabel(tab)}
            </a>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        {activeTab === "kennwerte" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Kennwerte</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Grundlegende Unternehmenskennwerte für den Strategiezyklus.
            </p>
            <form action={saveCompanyKennzahlen} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Organisationsform</span>
                <select
                  name="company_info_organizationsform"
                  defaultValue={companyKennzahlen.organizationsform}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Bitte waehlen —</option>
                  {ORGFORM_OPTIONS.filter((o) => o !== "other").map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  <option value="other">Sonstige</option>
                </select>
                <input
                  type="text"
                  name="company_info_organizationsform_other"
                  defaultValue={companyKennzahlen.organizationsform_other}
                  placeholder="Bei Sonstige: eigene Angabe"
                  className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Unternehmensgröße (Mitarbeitende)</span>
                <select
                  name="company_info_unternehmensgr\u00F6\u00DFe"
                  defaultValue={companyKennzahlen.unternehmensgroesse}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Bitte waehlen —</option>
                  {UNTERNEHMENSGROESSE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-zinc-700 md:col-span-2">
                <span className="mb-1 block font-medium">Industriekontext</span>
                <select
                  name="company_info_industriekontext"
                  defaultValue={companyKennzahlen.industriekontext}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Bitte waehlen —</option>
                  {INDUSTRIE_OPTIONS.filter((o) => o !== "other").map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  <option value="other">Sonstige</option>
                </select>
                <input
                  type="text"
                  name="company_info_industriekontext_other"
                  defaultValue={companyKennzahlen.industriekontext_other}
                  placeholder="Bei Sonstige: eigene Angabe"
                  className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700 md:col-span-2">
                <span className="mb-1 block font-medium">Kern-Wertschöpfung</span>
                <select
                  name="company_info_kern_wertsch\u00F6pfung"
                  defaultValue={companyKennzahlen.kern_wertschoepfung}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Bitte waehlen —</option>
                  {KERN_WERTSCHOEPFUNG_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name="company_info_wichtigstes_produkt_oder_dienstleistung"
                  defaultValue={companyKennzahlen.wichtigstes_produkt_oder_dienstleistung}
                  placeholder="Wichtigstes Produkt oder wichtigste Dienstleistung"
                  className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700 md:col-span-2">
                <span className="mb-1 block font-medium">Marktregionen</span>
                <div className="flex flex-wrap gap-2">
                  {MARKTREGIONEN_OPTIONS.map((region) => (
                    <label key={region} className="flex items-center gap-2 rounded border border-zinc-200 px-3 py-1.5">
                      <input
                        type="checkbox"
                        name="company_info_marktregionen"
                        value={region}
                        defaultChecked={companyKennzahlen.marktregionen.includes(region)}
                      />
                      <span className="text-sm">{region}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Umsatzgröße heute</span>
                <input
                  type="text"
                  name="company_info_umsatz_heute"
                  defaultValue={companyKennzahlen.umsatz_heute}
                  placeholder="z.B. 5 Mio. CHF"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700">
                <span className="mb-1 block font-medium">Umsatzgröße Ziel (Ende Strategiezyklus)</span>
                <input
                  type="text"
                  name="company_info_umsatz_ziel"
                  defaultValue={companyKennzahlen.umsatz_ziel}
                  placeholder="z.B. 8 Mio. CHF"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm text-zinc-700 md:col-span-2">
                <span className="mb-1 block font-medium">Transformation Status</span>
                <select
                  name="company_info_transformation_status"
                  defaultValue={companyKennzahlen.transformation_status}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Bitte waehlen —</option>
                  {TRANSFORMATION_STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2">
                <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
                  Speichern
                </button>
              </div>
            </form>
          </article>
        ) : null}
        {activeTab === "mission" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Mission</h2>
            <p className="mt-2 text-sm text-zinc-600">Unternehmensauftrag und Zweck.</p>
            <form action={saveStrategyReferenceText} className="mt-4">
              <input type="hidden" name="unternehmensinfo_return_l2" value="mission" />
              <input type="hidden" name="strategy_reference_vision" value={strategyReferenceFields.vision} />
              <input type="hidden" name="strategy_reference_culture" value={strategyReferenceFields.culture} />
              <input type="hidden" name="strategy_reference_values" value={strategyReferenceFields.values} />
              <input type="hidden" name="strategy_reference_leadership" value={strategyReferenceFields.leadership} />
              <textarea
                name="strategy_reference_mission"
                defaultValue={strategyReferenceFields.mission}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Unternehmensauftrag und Zweck..."
              />
              <button type="submit" disabled={!canWrite} className="mt-3 brand-btn px-4 py-2 text-sm">
                Speichern
              </button>
            </form>
          </article>
        ) : null}
        {activeTab === "vision" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Vision</h2>
            <p className="mt-2 text-sm text-zinc-600">Langfristiges Zukunftsbild.</p>
            <form action={saveStrategyReferenceText} className="mt-4">
              <input type="hidden" name="unternehmensinfo_return_l2" value="vision" />
              <input type="hidden" name="strategy_reference_mission" value={strategyReferenceFields.mission} />
              <input type="hidden" name="strategy_reference_culture" value={strategyReferenceFields.culture} />
              <input type="hidden" name="strategy_reference_values" value={strategyReferenceFields.values} />
              <input type="hidden" name="strategy_reference_leadership" value={strategyReferenceFields.leadership} />
              <textarea
                name="strategy_reference_vision"
                defaultValue={strategyReferenceFields.vision}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Langfristiges Zukunftsbild..."
              />
              <button type="submit" disabled={!canWrite} className="mt-3 brand-btn px-4 py-2 text-sm">
                Speichern
              </button>
            </form>
          </article>
        ) : null}
        {activeTab === "werte" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Werte</h2>
            <p className="mt-2 text-sm text-zinc-600">Werte und Entscheidungsgrundsätze.</p>
            <form action={saveStrategyReferenceText} className="mt-4">
              <input type="hidden" name="unternehmensinfo_return_l2" value="werte" />
              <input type="hidden" name="strategy_reference_mission" value={strategyReferenceFields.mission} />
              <input type="hidden" name="strategy_reference_vision" value={strategyReferenceFields.vision} />
              <input type="hidden" name="strategy_reference_culture" value={strategyReferenceFields.culture} />
              <input type="hidden" name="strategy_reference_leadership" value={strategyReferenceFields.leadership} />
              <textarea
                name="strategy_reference_values"
                defaultValue={strategyReferenceFields.values}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Werte und Entscheidungsgrunds\u00E4tze..."
              />
              <button type="submit" disabled={!canWrite} className="mt-3 brand-btn px-4 py-2 text-sm">
                Speichern
              </button>
            </form>
          </article>
        ) : null}
        {activeTab === "kultur" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Kultur</h2>
            <p className="mt-2 text-sm text-zinc-600">Zusammenarbeit, Verhalten und Prinzipien.</p>
            <form action={saveStrategyReferenceText} className="mt-4">
              <input type="hidden" name="unternehmensinfo_return_l2" value="kultur" />
              <input type="hidden" name="strategy_reference_mission" value={strategyReferenceFields.mission} />
              <input type="hidden" name="strategy_reference_vision" value={strategyReferenceFields.vision} />
              <input type="hidden" name="strategy_reference_values" value={strategyReferenceFields.values} />
              <input type="hidden" name="strategy_reference_leadership" value={strategyReferenceFields.leadership} />
              <textarea
                name="strategy_reference_culture"
                defaultValue={strategyReferenceFields.culture}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Zusammenarbeit, Verhalten und Prinzipien..."
              />
              <button type="submit" disabled={!canWrite} className="mt-3 brand-btn px-4 py-2 text-sm">
                Speichern
              </button>
            </form>
          </article>
        ) : null}
        {activeTab === "leadership" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Leadership</h2>
            <p className="mt-2 text-sm text-zinc-600">Führungsprinzipien und Erwartung an Leadership-Verhalten.</p>
            <form action={saveStrategyReferenceText} className="mt-4">
              <input type="hidden" name="unternehmensinfo_return_l2" value="leadership" />
              <input type="hidden" name="strategy_reference_mission" value={strategyReferenceFields.mission} />
              <input type="hidden" name="strategy_reference_vision" value={strategyReferenceFields.vision} />
              <input type="hidden" name="strategy_reference_culture" value={strategyReferenceFields.culture} />
              <input type="hidden" name="strategy_reference_values" value={strategyReferenceFields.values} />
              <textarea
                name="strategy_reference_leadership"
                defaultValue={strategyReferenceFields.leadership}
                rows={8}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="F\u00FChrungsprinzipien und Erwartung an Leadership-Verhalten..."
              />
              <button type="submit" disabled={!canWrite} className="mt-3 brand-btn px-4 py-2 text-sm">
                Speichern
              </button>
            </form>
          </article>
        ) : null}
        {activeTab === "sentinel-zusammenfassung" ? (
          <article className="brand-card p-6">
            <h2 className="text-lg font-semibold text-zinc-900">Sentinel✨ Zusammenfassung</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Aus Kennwerten und Strategiereferenz für Sentinel✨ Ziel-Bewertungen aufbereiteter strategischer Kontext
              (Cache in der Datenbank).
            </p>
            {!strategicContextCache ? (
              <p className="mt-4 text-sm text-zinc-600">
                Noch kein Eintrag. Die Zusammenfassung wird angelegt, sobald die Ziel-Bewertung den strategischen Kontext
                erstmalig erzeugt.
              </p>
            ) : !strategicContextCache.parsed ? (
              <p className="mt-4 text-sm text-amber-800">
                Gespeicherter Kontext konnte nicht gelesen werden. Bitte Ziel-Bewertung erneut anstossen oder Support
                kontaktieren.
              </p>
            ) : (
              <>
                {![
                  strategicContextCache.parsed.company_type,
                  strategicContextCache.parsed.scale,
                  strategicContextCache.parsed.industry_context,
                  strategicContextCache.parsed.value_creation_logic,
                  strategicContextCache.parsed.market_scope,
                  strategicContextCache.parsed.growth_ambition,
                  strategicContextCache.parsed.transformation_pressure,
                ].some(Boolean) && strategicContextCache.parsed.strategic_implications.length === 0 ? (
                  <p className="mt-4 text-sm text-zinc-600">
                    Der gespeicherte Kontext enthaelt noch keine ausfüllbaren Felder.
                  </p>
                ) : null}
                <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
                  {(
                    [
                      ["Unternehmenstyp", strategicContextCache.parsed.company_type],
                      ["Skala / Groesse", strategicContextCache.parsed.scale],
                      ["Industriekontext", strategicContextCache.parsed.industry_context],
                      ["Wertsch\u00F6pfungslogik", strategicContextCache.parsed.value_creation_logic],
                      ["Marktumfang", strategicContextCache.parsed.market_scope],
                      ["Wachstumsambition", strategicContextCache.parsed.growth_ambition],
                      ["Transformationsdruck", strategicContextCache.parsed.transformation_pressure],
                    ] as const
                  ).map(([label, value]) =>
                    value ? (
                      <div key={String(label)} className="md:col-span-2">
                        <dt className="font-medium text-zinc-800">{label}</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-zinc-700">{value}</dd>
                      </div>
                    ) : null
                  )}
                </dl>
                {strategicContextCache.parsed.strategic_implications.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium text-zinc-800">Strategische Implikationen</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
                      {strategicContextCache.parsed.strategic_implications.map((line, implIdx) => (
                        <li key={`${implIdx}-${line.slice(0, 48)}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="mt-6 text-xs text-zinc-500">
                  {[
                    [strategicContextCache.provider, strategicContextCache.model, strategicContextCache.prompt_version]
                      .filter(Boolean)
                      .join(" · "),
                    strategicContextCache.created_at
                      ? formatStrategyCycleTimestampUtc(strategicContextCache.created_at)
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Keine Metadaten (Erstellzeit unbekannt)"}
                </p>
              </>
            )}
          </article>
        ) : null}
      </section>
    </>
  );
}
