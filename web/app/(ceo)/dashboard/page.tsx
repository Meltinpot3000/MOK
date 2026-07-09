import Link from "next/link";
import { redirect } from "next/navigation";
import { CeoDashboardKpiCards } from "@/components/ceo/CeoDashboardKpiCards";
import { CyclePulseOverview } from "@/components/ceo/CyclePulseOverview";
import { DashboardTopLists } from "@/components/ceo/DashboardTopLists";
import { getPermissionCodesForMembership } from "@/lib/rbac/permission-codes";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getAuthenticatedUserId, getCeoDashboardData } from "@/lib/ceo/queries";
import { formatCreatorLabel } from "@/lib/creator/format";
import {
  buildChallengeResolutionProfileMap,
  toChallengeResolutionProfileDto,
} from "@/lib/strategy-cycle/challenge-resolution-profile";
import { computeStrategicDesignCorrelationSummary } from "@/lib/strategy-cycle/correlation";
import { fetchKeyResultProgressForPlanningCycle } from "@/lib/strategy-cycle/challenge-execution-data";
import { getStrategyCycleWorkspaceData } from "@/lib/strategy-cycle/queries";
import { resolveStrategyPlanningCycle } from "@/lib/strategy-cycle/pick-strategy-planning-cycle";

export default async function CeoDashboardPage() {
  const pageAccess = await getSidebarAccessContext("dashboard");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const access = pageAccess.access;
  const permissionCodes = await getPermissionCodesForMembership(access.membershipId);
  const canSendOkrReminders = permissionCodes.has("okr.write");
  const data = await getCeoDashboardData(access.organizationId);

  if (!data.selectedCycle) {
    return (
      <div className="space-y-4">
        <article className="brand-card p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-600">Übersicht über den aktiven Planungszyklus</p>
        </article>
        <div className="brand-card p-6">
          <p className="text-sm font-medium text-zinc-900">Keine Planungszyklen gefunden</p>
          <p className="mt-2 text-sm text-zinc-600">
            Bitte zuerst einen Zyklus in der Mittelfristplanung anlegen.
          </p>
        </div>
      </div>
    );
  }

  const cycleMainName =
    data.selectedCycle.cycle_scheme_name?.trim() ||
    data.selectedCycle.name
      .replace(/\s*-\s*L\d+\b.*$/i, "")
      .replace(/\s*\(L\d+\).*$/i, "")
      .replace(/\s*-\s*\d{3}(?:-\d{3})+$/i, "")
      .trim();
  const strategyCycle = await resolveStrategyPlanningCycle(access.organizationId);
  const strategyWorkspace = strategyCycle
    ? await getStrategyCycleWorkspaceData(
        access.organizationId,
        strategyCycle.id,
        strategyCycle.legacy_planning_cycle_id ?? undefined
      )
    : null;
  const topChallenges = [...(strategyWorkspace?.challenges ?? [])]
    .sort((a, b) => Number(b.challenge_score ?? 0) - Number(a.challenge_score ?? 0))
    .slice(0, 5);
  const topDirections = [...(strategyWorkspace?.strategicDirections ?? [])]
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0))
    .slice(0, 5);
  const linkedChallengeIds = new Set((strategyWorkspace?.challengeDirectionLinks ?? []).map((link) => link.strategic_challenge_id));
  const uncoveredChallenges = (strategyWorkspace?.challenges ?? []).filter((challenge) => !linkedChallengeIds.has(challenge.id));
  const challengeById = new Map((strategyWorkspace?.challenges ?? []).map((challenge) => [challenge.id, challenge]));
  const directionById = new Map(
    (strategyWorkspace?.strategicDirections ?? []).map((direction) => [direction.id, direction])
  );
  const analysisEntryById = new Map((strategyWorkspace?.entries ?? []).map((entry) => [entry.id, entry]));
  const directionIdsByChallengeId = new Map<string, string[]>();
  const challengeIdsByDirectionId = new Map<string, string[]>();
  const contributionByChallengeDirectionPair = new Map<string, string>();
  const analysisEntryIdsByChallengeId = new Map<string, string[]>();
  for (const link of strategyWorkspace?.challengeDirectionLinks ?? []) {
    const forChallenge = directionIdsByChallengeId.get(link.strategic_challenge_id) ?? [];
    if (!forChallenge.includes(link.strategic_direction_id)) forChallenge.push(link.strategic_direction_id);
    directionIdsByChallengeId.set(link.strategic_challenge_id, forChallenge);

    const forDirection = challengeIdsByDirectionId.get(link.strategic_direction_id) ?? [];
    if (!forDirection.includes(link.strategic_challenge_id)) forDirection.push(link.strategic_challenge_id);
    challengeIdsByDirectionId.set(link.strategic_direction_id, forDirection);
    contributionByChallengeDirectionPair.set(
      `${link.strategic_challenge_id}:${link.strategic_direction_id}`,
      String(link.contribution_level ?? "")
    );
  }
  for (const row of strategyWorkspace?.challengeAnalysisEntries ?? []) {
    const current = analysisEntryIdsByChallengeId.get(row.strategic_challenge_id) ?? [];
    if (!current.includes(row.analysis_entry_id)) current.push(row.analysis_entry_id);
    analysisEntryIdsByChallengeId.set(row.strategic_challenge_id, current);
  }
  for (const challenge of strategyWorkspace?.challenges ?? []) {
    const sourceId = (challenge as { source_analysis_entry_id?: string | null }).source_analysis_entry_id;
    if (!sourceId) continue;
    const current = analysisEntryIdsByChallengeId.get(challenge.id) ?? [];
    if (!current.includes(sourceId)) current.push(sourceId);
    analysisEntryIdsByChallengeId.set(challenge.id, current);
  }

  const { keyResultTargetLinks, keyResults } = await fetchKeyResultProgressForPlanningCycle(
    access.organizationId,
    data.selectedCycle.legacy_planning_cycle_id ?? undefined
  );

  const correlationSummary = computeStrategicDesignCorrelationSummary({
    challenges: (strategyWorkspace?.challenges ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      challenge_score: Number(c.challenge_score ?? 0),
      source_analysis_entry_id:
        (c as { source_analysis_entry_id?: string | null }).source_analysis_entry_id ?? null,
    })),
    objectives: (strategyWorkspace?.objectives ?? []).map((o) => ({
      id: o.id,
      title: o.title,
      importance_score: Number((o as { importance_score?: number | null }).importance_score ?? 0),
      versioning: o.versioning,
    })),
    directions: (strategyWorkspace?.strategicDirections ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      priority: d.priority ?? null,
    })),
    clusterMembers: strategyWorkspace?.clusterMembers ?? [],
    clusterObjectiveRelations: strategyWorkspace?.clusterObjectiveRelations ?? [],
    challengeDirectionLinks: strategyWorkspace?.challengeDirectionLinks ?? [],
    directionObjectiveLinks: strategyWorkspace?.directionObjectiveLinks ?? [],
    overrides: strategyWorkspace?.correlationStatusOverrides ?? [],
    analysisEntryIdsByChallengeId,
  });

  const resolutionProfileByChallengeId = buildChallengeResolutionProfileMap({
    challenges: (strategyWorkspace?.challenges ?? []).map((c) => ({ id: c.id, title: c.title })),
    challengeDirectionLinks: strategyWorkspace?.challengeDirectionLinks ?? [],
    directions: (strategyWorkspace?.strategicDirections ?? []).map((d) => ({
      id: d.id,
      title: d.title,
    })),
    correlationSummary,
    annualTargets: strategyWorkspace?.annualTargets ?? [],
    initiatives: strategyWorkspace?.initiatives ?? [],
    initiativeTargetLinks: strategyWorkspace?.initiativeTargetLinks ?? [],
    programs: strategyWorkspace?.programs ?? [],
    keyResultTargetLinks,
    keyResults,
  });

  const resolutionProfileDto = (challengeId: string) => {
    const profile = resolutionProfileByChallengeId.get(challengeId);
    return profile ? toChallengeResolutionProfileDto(profile) : null;
  };

  return (
    <div className="space-y-4">
      <article className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">
          {cycleMainName || data.selectedCycle.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Behalte den aktiven Zyklus im Blick und springe von hier direkt in die Detailanalyse.
        </p>
        <Link
          href={`/dashboard/cycles/${data.selectedCycle.id}`}
          className="mt-4 inline-block text-sm font-medium text-indigo-700 underline underline-offset-2 hover:text-indigo-900"
        >
          Zur Zyklus-Detailansicht →
        </Link>
      </article>

      <div className="space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="isolate min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
            <CyclePulseOverview
              cycles={data.cycles}
              nowIso={new Date().toISOString()}
              cyclePulse={data.cyclePulse}
              fillHeight
            />
          </div>
          <aside
            className="relative z-20 flex min-h-0 shrink-0 flex-col xl:w-[21.5rem] 2xl:w-96"
            aria-label="Kennzahlen zum Zyklus"
          >
            <section className="brand-card flex flex-col overflow-visible p-6">
              <div
                className="shrink-0 rounded-xl p-5 text-white"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, var(--brand-accent) 0%, color-mix(in srgb, var(--brand-accent) 72%, white) 100%)",
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                  Leitkennzahlen
                </p>
                <h2 className="mt-2 text-xl font-semibold">OKR-Zyklus im Überblick</h2>
              </div>
              <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-visible brand-surface rounded-xl p-3 sm:p-4">
                <CeoDashboardKpiCards
                  items={data.kpis}
                  overallProgressDetail={data.overallProgressDetail}
                  canSendReminders={canSendOkrReminders}
                  layout="aside"
                />
              </div>
            </section>
          </aside>
        </div>

        <DashboardTopLists
          topChallenges={topChallenges.map((challenge) => {
            const c = challenge as {
              created_at?: string;
              updated_at?: string;
              created_by_membership_id?: string | null;
              created_by_source?: string | null;
            };
            return {
              id: challenge.id,
              title: challenge.title,
              description:
                typeof (challenge as { description?: unknown }).description === "string"
                  ? String((challenge as { description: string }).description).trim() || null
                  : null,
              score: Number(challenge.challenge_score ?? 0),
              createdAt: c.created_at ?? null,
              updatedAt: c.updated_at ?? null,
              createdByLabel: formatCreatorLabel(
                c.created_by_source,
                c.created_by_membership_id
                  ? strategyWorkspace?.creatorDisplayNameByMembershipId[c.created_by_membership_id]
                  : null
              ),
              linkedDirections: (directionIdsByChallengeId.get(challenge.id) ?? [])
                .map((id) => directionById.get(id))
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
                .map((row) => ({
                  id: row.id,
                  title: row.title,
                  description:
                    typeof (row as { description?: unknown }).description === "string"
                      ? String((row as { description: string }).description).trim() || null
                      : null,
                  priority: Number(row.priority ?? 0),
                  status: (row as { status?: string | null }).status ?? null,
                  contributionLevel:
                    contributionByChallengeDirectionPair.get(`${challenge.id}:${row.id}`) || null,
                  linkedChallenges: (challengeIdsByDirectionId.get(row.id) ?? [])
                    .map((cid) => challengeById.get(cid))
                    .filter((c): c is NonNullable<typeof c> => Boolean(c))
                    .map((c) => ({
                      id: c.id,
                      title: c.title,
                      score: Number(c.challenge_score ?? 0),
                      contributionLevel:
                        contributionByChallengeDirectionPair.get(`${c.id}:${row.id}`) || null,
                    })),
                })),
              linkedAnalysisEntries: (analysisEntryIdsByChallengeId.get(challenge.id) ?? [])
                .map((id) => analysisEntryById.get(id))
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
                .map((row) => ({
                  id: row.id,
                  title: row.title,
                  analysisType: row.analysis_type ?? null,
                })),
              resolutionProfile: resolutionProfileDto(challenge.id),
            };
          })}
          topDirections={topDirections.map((direction) => ({
            id: direction.id,
            title: direction.title,
            description:
              typeof (direction as { description?: unknown }).description === "string"
                ? String((direction as { description: string }).description).trim() || null
                : null,
            priority: Number(direction.priority ?? 0),
            linkedChallenges: (challengeIdsByDirectionId.get(direction.id) ?? [])
              .map((id) => challengeById.get(id))
              .filter((row): row is NonNullable<typeof row> => Boolean(row))
              .map((row) => ({
                id: row.id,
                title: row.title,
                score: Number(row.challenge_score ?? 0),
                contributionLevel:
                  contributionByChallengeDirectionPair.get(`${row.id}:${direction.id}`) || null,
              })),
          }))}
          uncoveredChallenges={uncoveredChallenges.map((challenge) => {
            const c = challenge as {
              created_at?: string;
              updated_at?: string;
              created_by_membership_id?: string | null;
              created_by_source?: string | null;
            };
            return {
              id: challenge.id,
              title: challenge.title,
              description:
                typeof (challenge as { description?: unknown }).description === "string"
                  ? String((challenge as { description: string }).description).trim() || null
                  : null,
              score: Number(challenge.challenge_score ?? 0),
              createdAt: c.created_at ?? null,
              updatedAt: c.updated_at ?? null,
              createdByLabel: formatCreatorLabel(
                c.created_by_source,
                c.created_by_membership_id
                  ? strategyWorkspace?.creatorDisplayNameByMembershipId[c.created_by_membership_id]
                  : null
              ),
              linkedDirections: [],
              linkedAnalysisEntries: (analysisEntryIdsByChallengeId.get(challenge.id) ?? [])
                .map((id) => analysisEntryById.get(id))
                .filter((row): row is NonNullable<typeof row> => Boolean(row))
                .map((row) => ({
                  id: row.id,
                  title: row.title,
                  analysisType: row.analysis_type ?? null,
                })),
              resolutionProfile: resolutionProfileDto(challenge.id),
            };
          })}
        />
      </div>
    </div>
  );
}
