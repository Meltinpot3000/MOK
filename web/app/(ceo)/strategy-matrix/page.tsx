import Link from "next/link";
import { redirect } from "next/navigation";
import { getPhase0Context, getPlanningCycles } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  addComment,
  createAnnualTarget,
  createChallenge,
  createDirection,
  deleteCell,
  importExistingChallenge,
  importExistingDirection,
  promoteAnalysisToChallenge,
  removeChallengeFromDashboard,
  removeDirectionFromDashboard,
  setPrimaryAnnualTarget,
  updateAnnualTarget,
  updateChallenge,
  updateDirection,
  upsertCell,
} from "./actions";
import { getMatrixWorkspaceData } from "@/lib/strategy-matrix/queries";

type StrategyMatrixPageProps = {
  searchParams: Promise<{ drawer_direction_id?: string }>;
};

export default async function StrategyMatrixPage({ searchParams }: StrategyMatrixPageProps) {
  const resolvedSearchParams = await searchParams;
  const drawerDirectionId = resolvedSearchParams.drawer_direction_id ?? null;
  const pageAccess = await getSidebarAccessContext("strategy-matrix");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const cycles = await getPlanningCycles(context.organizationId);
  const selectedCycle = cycles[0] ?? null;
  if (!selectedCycle) {
    return (
      <section className="brand-card p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Strategie-Matrix</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Kein Planungszyklus vorhanden. Bitte zuerst einen Zyklus anlegen.
        </p>
      </section>
    );
  }

  const data = await getMatrixWorkspaceData(context.organizationId, selectedCycle.id);
  const uniqueOwnerOptions = Array.from(
    new Map(data.ownerOptions.map((option) => [option.membership_id, option])).values()
  );
  const cellByKey = new Map(
    data.cells.map((cell) => [`${cell.strategic_direction_id}__${cell.strategic_challenge_id}`, cell])
  );
  const commentsByObject = new Map<string, string[]>();
  for (const comment of data.comments) {
    const key = `${comment.object_type}__${comment.object_id}`;
    const current = commentsByObject.get(key) ?? [];
    current.push(comment.comment_text);
    commentsByObject.set(key, current);
  }

  const ownerNameByMembership = new Map(
    uniqueOwnerOptions.map((option) => [option.membership_id, option.full_name])
  );

  const targetsByDirection = new Map<string, typeof data.annualTargets>();
  for (const target of data.annualTargets) {
    const current = targetsByDirection.get(target.strategic_direction_id) ?? [];
    current.push(target);
    targetsByDirection.set(target.strategic_direction_id, current);
  }

  const drawerDirection =
    drawerDirectionId && data.directions.find((direction) => direction.id === drawerDirectionId);
  const drawerTargets = drawerDirection ? targetsByDirection.get(drawerDirection.id) ?? [] : [];

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategie Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategie-Matrix</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Zyklus: {selectedCycle.name} ({selectedCycle.code}) - interaktive Bearbeitung von Challenges,
          Directions, Beziehungen, Jahreszielen und Kommentaren.
        </p>
      </header>

      {!canWrite ? (
        <p className="brand-surface p-3 text-sm text-zinc-600">
          Diese Rolle hat Leserechte. Bearbeitungsfunktionen sind deaktiviert.
        </p>
      ) : null}

      <section className="brand-card p-6">
        <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <details className="brand-surface p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
              Add Challenge
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <form action={createChallenge} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">create new</p>
                <input name="title" required placeholder="Titel" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <input name="priority" type="number" min={1} max={5} defaultValue={3} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                  <select name="visibility" defaultValue="internal" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    <option value="internal">internal</option>
                    <option value="private">private</option>
                    <option value="public">public</option>
                  </select>
                  <input name="display_order" type="number" defaultValue={data.challenges.length + 1} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                </div>
                <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">Challenge anlegen</button>
              </form>

              <form action={importExistingChallenge} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">select existing</p>
                <select name="challenge_id" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Vorhandene Challenge waehlen</option>
                  {data.hiddenChallenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.title}
                    </option>
                  ))}
                </select>
                <input name="display_order" type="number" defaultValue={data.challenges.length + 1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={!canWrite || data.hiddenChallenges.length === 0} className="brand-btn-secondary px-3 py-1.5 text-xs">Existing importieren</button>
              </form>

              <form action={promoteAnalysisToChallenge} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">import from analysis (promote)</p>
                <select name="analysis_entry_id" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Analysebefund waehlen</option>
                  {data.analysisSuggestions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      [{entry.analysis_type}{entry.sub_type ? `/${entry.sub_type}` : ""}] {entry.title}
                    </option>
                  ))}
                </select>
                <input name="display_order" type="number" defaultValue={data.challenges.length + 1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={!canWrite || data.analysisSuggestions.length === 0} className="brand-btn-secondary px-3 py-1.5 text-xs">Als Challenge uebernehmen</button>
              </form>
            </div>
          </details>

          <details className="brand-surface p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
              Add Strategic Direction
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <form action={createDirection} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">create new</p>
                <input name="title" required placeholder="Titel" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <select name="owner_membership_id" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    <option value="">Owner waehlen</option>
                    {uniqueOwnerOptions.map((owner) => (
                      <option key={owner.membership_id} value={owner.membership_id}>
                        {owner.full_name}
                      </option>
                    ))}
                  </select>
                  <input name="grouping" placeholder="Grouping" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input name="priority" type="number" min={1} max={5} defaultValue={3} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                  <select name="status" defaultValue="draft" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    <option value="draft">draft</option>
                    <option value="active">active</option>
                    <option value="on_hold">on_hold</option>
                    <option value="completed">completed</option>
                  </select>
                  <input name="display_order" type="number" defaultValue={data.directions.length + 1} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                </div>
                <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">Direction anlegen</button>
              </form>

              <form action={importExistingDirection} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">select existing</p>
                <select name="direction_id" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Vorhandene Direction waehlen</option>
                  {data.hiddenDirections.map((direction) => (
                    <option key={direction.id} value={direction.id}>
                      {direction.title}
                    </option>
                  ))}
                </select>
                <input name="display_order" type="number" defaultValue={data.directions.length + 1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={!canWrite || data.hiddenDirections.length === 0} className="brand-btn-secondary px-3 py-1.5 text-xs">Existing importieren</button>
              </form>
            </div>
          </details>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 align-top text-left">
                <th className="py-2 pr-3 min-w-[280px]">Strategic Direction (Rows)</th>
                {data.challenges.map((challenge) => (
                  <th key={challenge.id} className="py-2 pr-3 min-w-[240px]">
                    <form action={updateChallenge} className="brand-surface p-2 space-y-2">
                      <input type="hidden" name="challenge_id" value={challenge.id} />
                      <input name="title" defaultValue={challenge.title} className="w-full rounded border border-zinc-300 px-2 py-1 text-xs" />
                      <div className="grid grid-cols-3 gap-1">
                        <input name="priority" type="number" min={1} max={5} defaultValue={challenge.priority} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                        <select name="visibility" defaultValue={challenge.visibility} className="rounded border border-zinc-300 px-1 py-1 text-xs">
                          <option value="internal">internal</option>
                          <option value="private">private</option>
                          <option value="public">public</option>
                        </select>
                        <input name="display_order" type="number" defaultValue={data.challenges.findIndex((item) => item.id === challenge.id) + 1} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                      </div>
                      <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">Header speichern</button>
                    </form>
                    <form action={removeChallengeFromDashboard} className="mt-1">
                      <input type="hidden" name="challenge_id" value={challenge.id} />
                      <button type="submit" disabled={!canWrite} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50">
                        Aus Dashboard entfernen
                      </button>
                    </form>
                  </th>
                ))}
                <th className="py-2 pr-3 min-w-[320px]">Annual Target (rechts)</th>
              </tr>
            </thead>
            <tbody>
              {data.directions.map((direction) => {
                const targets = targetsByDirection.get(direction.id) ?? [];
                const primaryTarget =
                  targets.find((target) => target.is_primary) ??
                  [...targets].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
                  null;
                const additionalTargets = primaryTarget
                  ? targets.filter((target) => target.id !== primaryTarget.id)
                  : targets;

                return (
                  <tr key={direction.id} className="border-b border-zinc-100 align-top">
                    <td className="py-3 pr-3">
                      <form action={updateDirection} className="brand-surface p-2 space-y-2">
                        <input type="hidden" name="direction_id" value={direction.id} />
                        <input name="title" defaultValue={direction.title} className="w-full rounded border border-zinc-300 px-2 py-1 text-xs" />
                        <div className="grid grid-cols-2 gap-1">
                          <select name="owner_membership_id" defaultValue={direction.owner_membership_id ?? ""} className="rounded border border-zinc-300 px-1 py-1 text-xs">
                            <option value="">Owner</option>
                            {uniqueOwnerOptions.map((owner) => (
                              <option key={owner.membership_id} value={owner.membership_id}>
                                {owner.full_name}
                              </option>
                            ))}
                          </select>
                          <input name="grouping" defaultValue={direction.grouping ?? ""} placeholder="Grouping" className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                        </div>
                        <div className="grid grid-cols-3 gap-1">
                          <input name="priority" type="number" min={1} max={5} defaultValue={direction.priority} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                          <select name="status" defaultValue={direction.status} className="rounded border border-zinc-300 px-1 py-1 text-xs">
                            <option value="draft">draft</option>
                            <option value="active">active</option>
                            <option value="on_hold">on_hold</option>
                            <option value="completed">completed</option>
                          </select>
                          <input name="display_order" type="number" defaultValue={data.directions.findIndex((item) => item.id === direction.id) + 1} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                        </div>
                        <div className="text-xs text-zinc-500">
                          Owner: {direction.owner_membership_id ? ownerNameByMembership.get(direction.owner_membership_id) ?? "n/a" : "nicht gesetzt"}
                        </div>
                        <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">Row speichern</button>
                      </form>
                      <form action={removeDirectionFromDashboard} className="mt-1">
                        <input type="hidden" name="direction_id" value={direction.id} />
                        <button type="submit" disabled={!canWrite} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50">
                          Aus Dashboard entfernen
                        </button>
                      </form>
                      <form action={addComment} className="mt-2 space-y-1">
                        <input type="hidden" name="object_type" value="direction" />
                        <input type="hidden" name="object_id" value={direction.id} />
                        <input name="comment_text" placeholder="Kommentar zur Direction" className="w-full rounded border border-zinc-300 px-2 py-1 text-xs" />
                        <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">Kommentar</button>
                      </form>
                      {(commentsByObject.get(`direction__${direction.id}`) ?? []).slice(0, 2).map((comment, idx) => (
                        <p key={idx} className="mt-1 text-xs text-zinc-600">- {comment}</p>
                      ))}
                    </td>

                    {data.challenges.map((challenge) => {
                      const key = `${direction.id}__${challenge.id}`;
                      const cell = cellByKey.get(key);
                      return (
                        <td key={key} className="py-3 pr-3">
                          <div className="brand-surface p-2 space-y-2">
                            <form action={upsertCell} className="space-y-1">
                              <input type="hidden" name="direction_id" value={direction.id} />
                              <input type="hidden" name="challenge_id" value={challenge.id} />
                              <select
                                name="contribution_level"
                                defaultValue={cell?.contribution_level ?? "medium"}
                                className="w-full rounded border border-zinc-300 px-1 py-1 text-xs"
                              >
                                <option value="low">low</option>
                                <option value="medium">medium</option>
                                <option value="high">high</option>
                              </select>
                              <input
                                name="note"
                                defaultValue={cell?.note ?? ""}
                                placeholder="Cell Note"
                                className="w-full rounded border border-zinc-300 px-1 py-1 text-xs"
                              />
                              <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">
                                {cell ? "Cell aktualisieren" : "Cell anlegen"}
                              </button>
                            </form>
                            {cell ? (
                              <form action={deleteCell}>
                                <input type="hidden" name="direction_id" value={direction.id} />
                                <input type="hidden" name="challenge_id" value={challenge.id} />
                                <button type="submit" disabled={!canWrite} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50">
                                  Beziehung loeschen
                                </button>
                              </form>
                            ) : null}
                            {cell ? (
                              <form action={addComment} className="space-y-1">
                                <input type="hidden" name="object_type" value="cell" />
                                <input type="hidden" name="object_id" value={cell.id} />
                                <input name="comment_text" placeholder="Kommentar zur Zelle" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                                <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">Kommentar</button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-3 pr-3">
                      <div className="brand-surface p-2 space-y-2">
                        {primaryTarget ? (
                          <form action={updateAnnualTarget} className="space-y-1">
                            <input type="hidden" name="target_id" value={primaryTarget.id} />
                            <input name="title" defaultValue={primaryTarget.title} className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                            <div className="grid grid-cols-3 gap-1">
                              <input name="baseline" type="number" step="0.01" defaultValue={primaryTarget.baseline ?? 0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                              <input name="current_measure" type="number" step="0.01" defaultValue={primaryTarget.current_measure ?? 0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                              <input name="progress_percent" type="number" step="0.1" min={0} max={100} defaultValue={primaryTarget.progress_percent} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                            </div>
                            <input name="comment" defaultValue={primaryTarget.comment ?? ""} placeholder="Kommentar" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                            <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">Primary Target speichern</button>
                          </form>
                        ) : (
                          <p className="text-xs text-zinc-500">Noch kein Annual Target vorhanden.</p>
                        )}

                        <form action={createAnnualTarget} className="space-y-1">
                          <input type="hidden" name="direction_id" value={direction.id} />
                          <input name="title" placeholder="Neues Annual Target" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                          <div className="grid grid-cols-3 gap-1">
                            <input name="baseline" type="number" step="0.01" defaultValue={0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                            <input name="current_measure" type="number" step="0.01" defaultValue={0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                            <input name="progress_percent" type="number" step="0.1" min={0} max={100} defaultValue={0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                          </div>
                          <input name="comment" placeholder="Kommentar" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">Target anlegen</button>
                        </form>

                        {additionalTargets.length > 0 ? (
                          <Link
                            href={`/strategy-matrix?drawer_direction_id=${direction.id}`}
                            className="inline-block rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                          >
                            Weitere Targets ({additionalTargets.length}) im Drawer
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {drawerDirection ? (
        <aside className="fixed right-4 top-20 z-40 w-[420px] max-h-[80vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-900">
              Targets Detail: {drawerDirection.title}
            </h2>
            <Link href="/strategy-matrix" className="rounded border border-zinc-300 px-2 py-1 text-xs">
              Schliessen
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {drawerTargets.length === 0 ? (
              <p className="text-sm text-zinc-600">Keine Targets vorhanden.</p>
            ) : (
              drawerTargets.map((target) => (
                <div key={target.id} className="brand-surface p-2">
                  <form action={updateAnnualTarget} className="space-y-1">
                    <input type="hidden" name="target_id" value={target.id} />
                    <input name="title" defaultValue={target.title} className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                    <div className="grid grid-cols-3 gap-1">
                      <input name="baseline" type="number" step="0.01" defaultValue={target.baseline ?? 0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                      <input name="current_measure" type="number" step="0.01" defaultValue={target.current_measure ?? 0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                      <input name="progress_percent" type="number" step="0.1" min={0} max={100} defaultValue={target.progress_percent} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                    </div>
                    <input name="comment" defaultValue={target.comment ?? ""} placeholder="Kommentar" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                    <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">
                      Speichern
                    </button>
                  </form>
                  <form action={setPrimaryAnnualTarget} className="mt-1">
                    <input type="hidden" name="direction_id" value={drawerDirection.id} />
                    <input type="hidden" name="target_id" value={target.id} />
                    <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">
                      {target.is_primary ? "Primary" : "Als Primary setzen"}
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
