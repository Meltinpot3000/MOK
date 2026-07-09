"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  getBrandSectionTheme,
  getBrandTopListTileSurface,
  type BrandColorToken,
  type BrandSectionTheme,
} from "@/lib/branding/brand-section-theme";
import { useHoverScale } from "@/lib/ui/use-hover-scale";
import { ChallengeResolutionProfilePanel } from "@/components/ceo/ChallengeResolutionProfilePanel";
import type { ChallengeResolutionProfileDto } from "@/lib/strategy-cycle/challenge-resolution-profile";

type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  score: number;
  createdAt: string | null;
  updatedAt: string | null;
  createdByLabel: string;
  linkedDirections: Array<{
    id: string;
    title: string;
    description: string | null;
    priority: number;
    status: string | null;
    contributionLevel: string | null;
    linkedChallenges: Array<{
      id: string;
      title: string;
      score: number;
      contributionLevel: string | null;
    }>;
  }>;
  linkedAnalysisEntries: Array<{
    id: string;
    title: string;
    analysisType: string | null;
  }>;
  resolutionProfile: ChallengeResolutionProfileDto | null;
};

type DirectionRow = {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  linkedChallenges: Array<{
    id: string;
    title: string;
    score: number;
    contributionLevel: string | null;
  }>;
};

type Props = {
  topChallenges: ChallengeRow[];
  topDirections: DirectionRow[];
  uncoveredChallenges: ChallengeRow[];
};

type SelectedItem =
  | { kind: "challenge"; rank: number; item: ChallengeRow }
  | { kind: "direction"; rank: number; item: DirectionRow }
  | { kind: "uncovered"; rank: number; item: ChallengeRow };

/** Primaer / Sekundaer / Akzent gemaess Markenauftritt. */
const SECTION_THEMES = {
  challenges: getBrandSectionTheme("primary"),
  directions: getBrandSectionTheme("secondary"),
  uncovered: getBrandSectionTheme("accent"),
} as const;

const MODAL_BODY_BG: Record<BrandColorToken, string> = {
  primary: "color-mix(in srgb, var(--brand-primary) 8%, white)",
  secondary: "color-mix(in srgb, var(--brand-secondary) 8%, white)",
  accent: "color-mix(in srgb, var(--brand-accent) 8%, white)",
};

function primaryDescription(item: ChallengeRow | DirectionRow): string | null {
  return item.description?.trim() ? item.description.trim() : null;
}

function formatDateTimeDe(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

function contributionLabel(level: string | null): string {
  if (!level?.trim()) return "Beitrag nicht gesetzt";
  return `Beitrag ${level}`;
}

function modalThemeForSelection(selected: SelectedItem): BrandSectionTheme {
  if (selected.kind === "direction") return SECTION_THEMES.directions;
  return SECTION_THEMES.challenges;
}

function colorTokenForSelection(selected: SelectedItem): BrandColorToken {
  if (selected.kind === "direction") return "secondary";
  return "primary";
}

function MetaTile({ label, value, theme }: { label: string; value: string; theme: BrandSectionTheme }) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={theme.tile}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function BrandDrillTile({
  title,
  subtitle,
  badge,
  colorToken,
  onClick,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  colorToken: BrandColorToken;
  onClick: () => void;
}) {
  const hover = useHoverScale({ scale: 1.01 });

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...getBrandTopListTileSurface(colorToken, hover.hovered, 22),
        ...hover.style,
      }}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      className="flex min-h-[4.5rem] w-full flex-col justify-between rounded-xl border-0 p-3 text-left ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
    >
      <div>
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">{title}</p>
        <p className="mt-1 text-xs text-zinc-600">{subtitle}</p>
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
        {badge ?? "Details anzeigen →"}
      </p>
    </button>
  );
}

function ChallengeModalBody({
  selected,
  challengeItem,
  theme,
  colorToken,
}: {
  selected: Extract<SelectedItem, { kind: "challenge" } | { kind: "uncovered" }>;
  challengeItem: ChallengeRow;
  theme: BrandSectionTheme;
  colorToken: BrandColorToken;
}) {
  const [drilledDirectionId, setDrilledDirectionId] = useState<string | null>(null);
  const desc = primaryDescription(challengeItem);
  const drilledDirection =
    drilledDirectionId != null
      ? challengeItem.linkedDirections.find((d) => d.id === drilledDirectionId) ?? null
      : null;

  if (drilledDirection) {
    const directionDesc = drilledDirection.description?.trim() || null;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setDrilledDirectionId(null)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-white/60"
          style={theme.metaPill}
        >
          ← Zurück zur Herausforderung
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Stoßrichtung</p>
        <h4 className="text-base font-semibold text-zinc-900">{drilledDirection.title}</h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetaTile label="Priorität" value={drilledDirection.priority.toFixed(2)} theme={theme} />
          <MetaTile
            label="Status"
            value={drilledDirection.status?.trim() || "—"}
            theme={theme}
          />
          <MetaTile
            label="Beitrag zu dieser Herausforderung"
            value={contributionLabel(drilledDirection.contributionLevel)}
            theme={theme}
          />
        </div>
        {directionDesc ? (
          <div className="rounded-lg border px-3 py-2.5" style={theme.tile}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Beschreibung</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{directionDesc}</p>
          </div>
        ) : null}
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Verknüpfte Herausforderungen
            </h4>
            <span className="text-xs tabular-nums text-zinc-500">
              {drilledDirection.linkedChallenges.length}
            </span>
          </div>
          {drilledDirection.linkedChallenges.length === 0 ? (
            <p className="text-sm text-zinc-600">Keine weiteren Herausforderungen verknüpft.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {drilledDirection.linkedChallenges.map((challenge) => {
                const isCurrent = challenge.id === challengeItem.id;
                return (
                  <div
                    key={challenge.id}
                    className="rounded-xl border-0 p-3"
                    style={getBrandTopListTileSurface(colorToken, false, isCurrent ? 32 : 14)}
                  >
                    <p className="text-sm font-semibold text-zinc-900">{challenge.title}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      Score {challenge.score.toFixed(2)} · {contributionLabel(challenge.contributionLevel)}
                    </p>
                    {isCurrent ? (
                      <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                        Aktuelle Herausforderung
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MetaTile label="Erstellt am" value={formatDateTimeDe(challengeItem.createdAt)} theme={theme} />
        <MetaTile label="Erstellt von" value={challengeItem.createdByLabel} theme={theme} />
        <MetaTile label="Zuletzt geändert" value={formatDateTimeDe(challengeItem.updatedAt)} theme={theme} />
        <MetaTile label="Challenge-Score" value={challengeItem.score.toFixed(2)} theme={theme} />
      </div>

      {desc ? (
        <div className="rounded-lg border px-3 py-2.5" style={theme.tile}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Beschreibung</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{desc}</p>
        </div>
      ) : null}

      {selected.kind === "uncovered" ? (
        <p
          className="rounded-lg border px-3 py-2 text-sm"
          style={theme.successPanel}
        >
          Diese Herausforderung ist aktuell mit keiner Stoßrichtung verknüpft.
        </p>
      ) : null}

      {challengeItem.resolutionProfile ? (
        <ChallengeResolutionProfilePanel profile={challengeItem.resolutionProfile} theme={theme} />
      ) : null}

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Verknüpfte Stoßrichtungen
          </h4>
          <span className="text-xs tabular-nums text-zinc-500">{challengeItem.linkedDirections.length}</span>
        </div>
        {challengeItem.linkedDirections.length === 0 ? (
          <p className="text-sm text-zinc-600">Keine verknüpften Stoßrichtungen.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {challengeItem.linkedDirections.map((direction) => (
              <BrandDrillTile
                key={direction.id}
                colorToken={colorToken}
                title={direction.title}
                subtitle={contributionLabel(direction.contributionLevel)}
                badge="Im Pop-up anzeigen →"
                onClick={() => setDrilledDirectionId(direction.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Verknüpfte Analysen</h4>
          <span className="text-xs tabular-nums text-zinc-500">
            {challengeItem.linkedAnalysisEntries.length}
          </span>
        </div>
        {challengeItem.linkedAnalysisEntries.length === 0 ? (
          <p className="text-sm text-zinc-600">Keine verknüpften Analyse-Einträge.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {challengeItem.linkedAnalysisEntries.map((entry) => (
              <Link
                key={entry.id}
                href={`/strategy-cycle?l1=analysis&l2=entries#entry-${entry.id}`}
                className="flex min-h-[4.5rem] flex-col justify-between rounded-xl border-0 p-3 text-left no-underline ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
                style={getBrandTopListTileSurface(colorToken, false, 18)}
              >
                <div>
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">{entry.title}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {entry.analysisType ? `Typ: ${entry.analysisType}` : "Analyse-Eintrag"}
                  </p>
                </div>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                  Analyse öffnen →
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardTopListModal({
  selected,
  onClose,
}: {
  selected: SelectedItem;
  onClose: () => void;
}) {
  const theme = modalThemeForSelection(selected);
  const colorToken = colorTokenForSelection(selected);
  const desc = primaryDescription(selected.item);
  const isChallenge = selected.kind === "challenge" || selected.kind === "uncovered";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/45 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detailansicht"
        className="flex max-h-[min(90vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border-0 bg-white shadow-xl"
        style={{ borderColor: theme.tile.borderColor as string }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-3 px-5 py-4 text-white"
          style={theme.header}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/85">
              {selected.kind === "direction"
                ? `Top Stoßrichtung #${selected.rank}`
                : selected.kind === "challenge"
                  ? `Top Herausforderung #${selected.rank}`
                  : `Unadressierte Herausforderung #${selected.rank}`}
            </p>
            <h3 className="mt-1 text-lg font-semibold leading-snug">{selected.item.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-white/30 bg-white/15 px-2.5 py-1 text-xs text-white hover:bg-white/25"
          >
            Schließen
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          style={{ backgroundColor: MODAL_BODY_BG[colorToken] }}
        >
          {isChallenge ? (
            <ChallengeModalBody
              key={selected.item.id}
              selected={selected}
              challengeItem={selected.item}
              theme={theme}
              colorToken={colorToken}
            />
          ) : selected.kind === "direction" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <MetaTile label="Priorität" value={selected.item.priority.toFixed(2)} theme={theme} />
              </div>
              {desc ? (
                <div className="rounded-lg border px-3 py-2.5" style={theme.tile}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Beschreibung</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{desc}</p>
                </div>
              ) : null}
              <section>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Verknüpfte Herausforderungen
                  </h4>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {selected.item.linkedChallenges.length}
                  </span>
                </div>
                {selected.item.linkedChallenges.length === 0 ? (
                  <p className="text-sm text-zinc-600">Keine verknüpften Herausforderungen.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selected.item.linkedChallenges.map((challenge) => (
                      <div
                        key={challenge.id}
                        className="rounded-xl border-0 p-3"
                        style={getBrandTopListTileSurface(colorToken, false, 18)}
                      >
                        <p className="text-sm font-semibold text-zinc-900">{challenge.title}</p>
                        <p className="mt-1 text-xs text-zinc-600">
                          Score {challenge.score.toFixed(2)} · {contributionLabel(challenge.contributionLevel)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function RankBadge({ rank, style }: { rank: number; style: CSSProperties }) {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 text-xs font-bold tabular-nums"
      style={style}
      aria-hidden
    >
      {rank}
    </span>
  );
}

function DashboardTopListSection({
  theme,
  title,
  subtitle,
  count,
  children,
  emptyState,
}: {
  theme: BrandSectionTheme;
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
  emptyState?: ReactNode;
}) {
  return (
    <article className="brand-card flex flex-col overflow-visible">
      <div className="px-4 py-3.5 text-white shadow-sm sm:px-5" style={theme.header}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold tracking-tight sm:text-base">{title}</h2>
            <p className="mt-0.5 text-[11px] text-white/85 sm:text-xs">{subtitle}</p>
          </div>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white ring-1 ring-white/25">
            {count}
          </span>
        </div>
      </div>
      <div className="relative z-0 flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {emptyState ?? children}
      </div>
    </article>
  );
}

const TOP_LIST_TILE_GLOW =
  "pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/50 opacity-0 blur-2xl transition group-hover:opacity-80";

function TopListTile({
  rank,
  title,
  theme,
  colorToken,
  onClick,
  children,
}: {
  rank: number;
  title: string;
  theme: BrandSectionTheme;
  colorToken: BrandColorToken;
  onClick: () => void;
  children: ReactNode;
}) {
  const hover = useHoverScale({ scale: 1.02 });

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...getBrandTopListTileSurface(colorToken, hover.hovered, 30),
        ...hover.style,
      }}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      className="group relative flex w-full cursor-pointer gap-3 overflow-hidden rounded-2xl border-0 p-3.5 text-left ring-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      <div className={TOP_LIST_TILE_GLOW} aria-hidden />
      <RankBadge rank={rank} style={theme.rankBadge} />
      <div className="relative z-[1] min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-zinc-950">
          {title}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
      </div>
    </button>
  );
}

function MetaPill({ theme, children }: { theme: BrandSectionTheme; children: ReactNode }) {
  return (
    <span
      className="rounded-md px-2 py-0.5 text-[10px] font-medium leading-tight text-zinc-700"
      style={theme.metaPill}
    >
      {children}
    </span>
  );
}

export function DashboardTopLists({ topChallenges, topDirections, uncoveredChallenges }: Props) {
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const uncoveredTopFive = useMemo(() => uncoveredChallenges.slice(0, 5), [uncoveredChallenges]);

  const challengeTheme = SECTION_THEMES.challenges;
  const directionTheme = SECTION_THEMES.directions;
  const uncoveredTheme = SECTION_THEMES.uncovered;

  return (
    <>
      <section className="relative z-10 grid grid-cols-1 gap-4 p-0.5 xl:grid-cols-3">
        <DashboardTopListSection
          theme={challengeTheme}
          title="Top 5 Herausforderungen"
          subtitle="Nach Challenge-Score sortiert"
          count={topChallenges.length}
        >
          {topChallenges.length === 0 ? (
            <p className="rounded-xl bg-zinc-100/90 px-3 py-4 text-center text-sm text-zinc-600">
              Keine Herausforderungen im Zyklus.
            </p>
          ) : (
            topChallenges.map((challenge, idx) => (
              <TopListTile
                key={challenge.id}
                rank={idx + 1}
                title={challenge.title}
                theme={challengeTheme}
                colorToken="primary"
                onClick={() => setSelected({ kind: "challenge", rank: idx + 1, item: challenge })}
              >
                <MetaPill theme={challengeTheme}>Score {challenge.score.toFixed(2)}</MetaPill>
                <MetaPill theme={challengeTheme}>{challenge.linkedDirections.length} Stoßrichtungen</MetaPill>
                <MetaPill theme={challengeTheme}>{challenge.linkedAnalysisEntries.length} Analysen</MetaPill>
              </TopListTile>
            ))
          )}
        </DashboardTopListSection>

        <DashboardTopListSection
          theme={directionTheme}
          title="Top 5 Stoßrichtungen"
          subtitle="Nach Priorität sortiert"
          count={topDirections.length}
        >
          {topDirections.length === 0 ? (
            <p className="rounded-xl bg-zinc-100/90 px-3 py-4 text-center text-sm text-zinc-600">
              Keine Stoßrichtungen im Zyklus.
            </p>
          ) : (
            topDirections.map((direction, idx) => (
              <TopListTile
                key={direction.id}
                rank={idx + 1}
                title={direction.title}
                theme={directionTheme}
                colorToken="secondary"
                onClick={() => setSelected({ kind: "direction", rank: idx + 1, item: direction })}
              >
                <MetaPill theme={directionTheme}>Priorität {direction.priority.toFixed(2)}</MetaPill>
                <MetaPill theme={directionTheme}>
                  {direction.linkedChallenges.length} Herausforderungen
                </MetaPill>
              </TopListTile>
            ))
          )}
        </DashboardTopListSection>

        <DashboardTopListSection
          theme={uncoveredTheme}
          title="Unadressierte Herausforderungen"
          subtitle="Ohne Stoßrichtungs-Verknüpfung"
          count={uncoveredTopFive.length}
          emptyState={
            uncoveredTopFive.length === 0 ? (
              <div
                className="flex flex-1 items-center justify-center rounded-xl px-4 py-6 text-center"
                style={uncoveredTheme.successPanel}
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">Vollständig adressiert</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Alle Herausforderungen sind mit mindestens einer Stoßrichtung verknüpft.
                  </p>
                </div>
              </div>
            ) : undefined
          }
        >
          {uncoveredTopFive.map((challenge, idx) => (
            <TopListTile
              key={challenge.id}
              rank={idx + 1}
              title={challenge.title}
              theme={uncoveredTheme}
              colorToken="accent"
              onClick={() => setSelected({ kind: "uncovered", rank: idx + 1, item: challenge })}
            >
              <MetaPill theme={uncoveredTheme}>Score {challenge.score.toFixed(2)}</MetaPill>
              <MetaPill theme={uncoveredTheme}>Ohne Stoßrichtung</MetaPill>
            </TopListTile>
          ))}
        </DashboardTopListSection>
      </section>

      {selected ? <DashboardTopListModal selected={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
