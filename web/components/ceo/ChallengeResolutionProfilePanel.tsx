import Link from "next/link";
import type { ChallengeResolutionProfileDto } from "@/lib/strategy-cycle/challenge-resolution-profile";
import type { BrandSectionTheme } from "@/lib/branding/brand-section-theme";

const COHERENCE_TONE: Record<string, string> = {
  green: "text-emerald-800 bg-emerald-50 border-emerald-200",
  yellow: "text-amber-900 bg-amber-50 border-amber-200",
  red: "text-red-900 bg-red-50 border-red-200",
  unknown: "text-zinc-700 bg-zinc-50 border-zinc-200",
  not_assessed: "text-zinc-600 bg-zinc-50 border-zinc-200",
};

const ADDRESSING_TONE: Record<string, string> = {
  none: "text-zinc-600 bg-zinc-50 border-zinc-200",
  weak: "text-amber-900 bg-amber-50 border-amber-200",
  medium: "text-sky-900 bg-sky-50 border-sky-200",
  strong: "text-emerald-900 bg-emerald-50 border-emerald-200",
};

const EXECUTION_TONE: Record<string, string> = {
  not_measurable: "text-zinc-600 bg-zinc-50 border-zinc-200",
  early: "text-violet-900 bg-violet-50 border-violet-200",
  in_progress: "text-sky-900 bg-sky-50 border-sky-200",
  advanced: "text-emerald-900 bg-emerald-50 border-emerald-200",
  largely_delivered: "text-emerald-900 bg-emerald-50 border-emerald-200",
};

function ProfileDimensionTile({
  label,
  value,
  detail,
  toneClass,
}: {
  label: string;
  value: string;
  detail?: string | null;
  toneClass: string;
}) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] opacity-90">{detail}</p> : null}
    </div>
  );
}

export function ChallengeResolutionProfilePanel({
  profile,
  theme,
}: {
  profile: ChallengeResolutionProfileDto;
  theme: BrandSectionTheme;
}) {
  const executionDetail =
    profile.executionPercent != null
      ? `${profile.executionAnchorCount} Umsetzungsanker`
      : profile.executionAnchorCount > 0
        ? `${profile.executionAnchorCount} Anker`
        : null;

  const fulfillmentDisplay =
    profile.fulfillmentPercent != null ? `${profile.fulfillmentPercent} %` : "—";
  const calcKrDisplay =
    profile.calculatedProgressFromKeyResults != null
      ? `${profile.calculatedProgressFromKeyResults} %`
      : "—";
  const calcInitDisplay =
    profile.calculatedProgressFromInitiatives != null
      ? `${profile.calculatedProgressFromInitiatives} %`
      : "—";
  const managementDisplay =
    profile.managementAssessedProgress != null ? `${profile.managementAssessedProgress} %` : "—";
  const divergencePp =
    profile.managementAssessedProgress != null && profile.calculatedProgressFromKeyResults != null
      ? Math.abs(profile.managementAssessedProgress - profile.calculatedProgressFromKeyResults)
      : null;

  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Systemvorschlag: Herausforderungs-Profil
        </h4>
        <p className="mt-1 text-[11px] text-zinc-600">
          Erfüllungsgrad = gewichteter Fortschritt aus Jahreszielen, Initiativen und verknüpften Key Results.
        </p>
      </div>

      <div
        className="flex flex-col gap-1 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        style={theme.tile}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Erfüllungsgrad</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-zinc-900">{fulfillmentDisplay}</p>
        </div>
        <p className="text-xs text-zinc-600">{profile.executionLabelDe}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ProfileDimensionTile
          label="Management-Fortschritt"
          value={managementDisplay}
          detail={`Quelle: ${profile.progressSource}`}
          toneClass="text-zinc-800 bg-zinc-50 border-zinc-200"
        />
        <ProfileDimensionTile
          label="Berechnet aus KRs"
          value={calcKrDisplay}
          toneClass="text-sky-900 bg-sky-50 border-sky-200"
        />
        <ProfileDimensionTile
          label="Berechnet aus Initiativen"
          value={calcInitDisplay}
          toneClass="text-violet-900 bg-violet-50 border-violet-200"
        />
      </div>
      {divergencePp != null && divergencePp > 15 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Hinweis: Management-Fortschritt und KR-Berechnung weichen um {Math.round(divergencePp)} Prozentpunkte ab.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ProfileDimensionTile
          label="Adressierung"
          value={profile.addressingLabelDe}
          toneClass={ADDRESSING_TONE[profile.addressing] ?? ADDRESSING_TONE.none}
        />
        <ProfileDimensionTile
          label="Kohärenz"
          value={profile.coherenceLabelDe}
          toneClass={COHERENCE_TONE[profile.coherence] ?? COHERENCE_TONE.not_assessed}
        />
        <ProfileDimensionTile
          label="Umsetzung"
          value={profile.executionLabelDe}
          detail={executionDetail}
          toneClass={EXECUTION_TONE[profile.executionBand] ?? EXECUTION_TONE.not_measurable}
        />
      </div>

      <div className="rounded-lg border px-3 py-2.5 text-sm leading-relaxed text-zinc-800" style={theme.tile}>
        {profile.systemHintDe}
      </div>

      {profile.fulfillmentGaps.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Fortschritt pflegen
          </p>
          <ul className="mt-2 space-y-1.5">
            {profile.fulfillmentGaps.map((gap) => (
              <li key={gap.id}>
                <Link
                  href={gap.href}
                  className="text-xs font-medium text-amber-950 underline underline-offset-2 hover:text-amber-800"
                >
                  {gap.labelDe} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {profile.weakestCorrelation ? (
        <p className="text-xs text-zinc-600">
          Schwächste Korrelation:{" "}
          <span className="font-medium text-zinc-800">{profile.weakestCorrelation.objectiveTitle}</span>
          {" · "}
          {profile.weakestCorrelation.directionTitle} ({profile.weakestCorrelation.status})
        </p>
      ) : null}

      {profile.executionSources.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Fortschrittsquellen
          </p>
          <ul className="mt-1 space-y-1 text-xs text-zinc-600">
            {profile.executionSources.map((src, i) => (
              <li key={`${src.label}-${i}`}>
                {src.label}: {Math.round(src.progress)} %
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
