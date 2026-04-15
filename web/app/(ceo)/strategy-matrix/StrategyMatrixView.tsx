import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmBeforeSubmitForm } from "@/components/ui/ConfirmBeforeSubmitForm";
import { getActivePlanningCycle, getPhase0Context } from "@/lib/phase0/queries";
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
} from "@/app/(ceo)/strategy-matrix/actions";
import { getMatrixWorkspaceData } from "@/lib/strategy-matrix/queries";
import {
  STRATEGIC_DIRECTION_STATUSES,
  STRATEGIC_DIRECTION_STATUS_LABELS_DE,
  isStrategicDirectionVisibleInProgramMatrix,
  normalizeStrategicDirectionStatus,
} from "@/lib/strategy-cycle/strategic-direction-lifecycle";

type StrategyMatrixViewProps = {
  drawerDirectionId?: string | null;
};

export async function StrategyMatrixView({ drawerDirectionId = null }: StrategyMatrixViewProps) {
  const strategyMatrixBaseHref = "/strategy-cycle?l1=corporate-strategy&l2=strategy-matrix";
  const pageAccess = await getSidebarAccessContext("strategy-cycle");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");
  const canWrite = pageAccess.canWrite;

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const selectedCycle = await getActivePlanningCycle(context.organizationId);
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

  const visibleDirections = data.directions.filter((direction) =>
    isStrategicDirectionVisibleInProgramMatrix(direction.status)
  );

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategiezyklus</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Strategie-Matrix</h1>
        <p className="mt-1 text-sm text-zinc-600">
          
          Bearbeite Zusammenhänge zwischen Herausforderungen, Stoßrichtungen und Jahreszielen in einer Ansicht.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Zyklus: {selectedCycle.name} ({selectedCycle.code})
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
              Herausforderung hinzufuegen
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <form action={createChallenge} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">Neu erstellen</p>
                <input name="title" required placeholder="Titel" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <input name="priority" type="number" min={1} max={5} defaultValue={3} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                  <select name="visibility" defaultValue="internal" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    <option value="internal">intern</option>
                    <option value="private">privat</option>
                    <option value="public">oeffentlich</option>
                  </select>
                  <input name="display_order" type="number" defaultValue={data.challenges.length + 1} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                </div>
                <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">Herausforderung anlegen</button>
              </form>

              <form action={importExistingChallenge} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">Vorhandene waehlen</p>
                <select name="challenge_id" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Vorhandene Herausforderung waehlen</option>
                  {data.hiddenChallenges.map((challenge) => (
                    <option key={challenge.id} value={challenge.id}>
                      {challenge.title}
                    </option>
                  ))}
                </select>
                <input name="display_order" type="number" defaultValue={data.challenges.length + 1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={!canWrite || data.hiddenChallenges.length === 0} className="brand-btn-secondary px-3 py-1.5 text-xs">Auswählen und importieren</button>
              </form>

              <form action={promoteAnalysisToChallenge} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">Aus Analyse übernehmen</p>
                <select name="analysis_entry_id" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Analysebefund waehlen</option>
                  {data.analysisSuggestions.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      [{entry.analysis_type}{entry.sub_type ? `/${entry.sub_type}` : ""}] {entry.title}
                    </option>
                  ))}
                </select>
                <input name="display_order" type="number" defaultValue={data.challenges.length + 1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={!canWrite || data.analysisSuggestions.length === 0} className="brand-btn-secondary px-3 py-1.5 text-xs">Als Herausforderung übernehmen</button>
              </form>
            </div>
          </details>

          <details className="brand-surface p-3" open>
            <summary className="cursor-pointer text-sm font-semibold text-zinc-900">
              
              Stoßrichtung hinzufuegen
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3">
              <form action={createDirection} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">Neu erstellen</p>
                <input name="title" required placeholder="Titel" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <select name="owner_membership_id" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    <option value="">Verantwortliche Person waehlen</option>
                    {uniqueOwnerOptions.map((owner) => (
                      <option key={owner.membership_id} value={owner.membership_id}>
                        {owner.full_name}
                      </option>
                    ))}
                  </select>
                  <input name="grouping" placeholder="Gruppierung" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                </div>
                <p className="text-[11px] text-zinc-500">
                  
                  Priorität (Score) wird aus den vier Bewertungen im Strategiezyklus berechnet; bei Neuanlage hier zunaechst 3,00 (Default-Bewertungen).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select name="status" defaultValue="draft" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                    {STRATEGIC_DIRECTION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STRATEGIC_DIRECTION_STATUS_LABELS_DE[s]}
                      </option>
                    ))}
                  </select>
                  <input name="display_order" type="number" defaultValue={data.directions.length + 1} className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                </div>
                <button type="submit" disabled={!canWrite} className="brand-btn px-3 py-1.5 text-xs">Stoßrichtung anlegen</button>
              </form>

              <form action={importExistingDirection} className="space-y-2">
                <p className="text-xs font-medium text-zinc-700">Vorhandene waehlen</p>
                <select name="direction_id" className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                  <option value="">Vorhandene Stoßrichtung waehlen</option>
                  {data.hiddenDirections.map((direction) => (
                    <option key={direction.id} value={direction.id}>
                      {direction.title}
                    </option>
                  ))}
                </select>
                <input name="display_order" type="number" defaultValue={data.directions.length + 1} className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
                <button type="submit" disabled={!canWrite || data.hiddenDirections.length === 0} className="brand-btn-secondary px-3 py-1.5 text-xs">Auswählen und importieren</button>
              </form>
            </div>
          </details>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 align-top text-left">
                <th className="py-2 pr-3 min-w-[280px]">
                  
                  Strategische Stoßrichtung (Zeilen)
                  <p className="mt-1 max-w-[280px] text-[11px] font-normal text-zinc-500">
                    
                    Nur Genehmigt, Aktiv oder Pausiert. Entwürfe und Abgeschlossene sind ausgeblendet.
                  </p>
                </th>
                {data.challenges.map((challenge) => (
                  <th key={challenge.id} className="py-2 pr-3 min-w-[240px]">
                    <form action={updateChallenge} className="brand-surface p-2 space-y-2">
                      <input type="hidden" name="challenge_id" value={challenge.id} />
                      <input name="title" defaultValue={challenge.title} className="w-full rounded border border-zinc-300 px-2 py-1 text-xs" />
                      <div className="grid grid-cols-3 gap-1">
                        <input name="priority" type="number" min={1} max={5} defaultValue={challenge.priority} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                        <select name="visibility" defaultValue={challenge.visibility} className="rounded border border-zinc-300 px-1 py-1 text-xs">
                          <option value="internal">intern</option>
                          <option value="private">privat</option>
                          <option value="public">oeffentlich</option>
                        </select>
                        <input name="display_order" type="number" defaultValue={data.challenges.findIndex((item) => item.id === challenge.id) + 1} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                      </div>
                      <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">Header speichern</button>
                    </form>
                    <ConfirmBeforeSubmitForm
                      action={removeChallengeFromDashboard}
                      className="mt-1"
                      title="Herausforderung aus dem Dashboard entfernen?"
                      description="Die Spalte wird aus dieser Matrix genommen; vorhandene Bewertungen in Zellen können entfallen."
                      confirmLabel="Entfernen"
                    >
                      <input type="hidden" name="challenge_id" value={challenge.id} />
                      <button type="submit" disabled={!canWrite} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50">
                        Aus Dashboard entfernen
                      </button>
                    </ConfirmBeforeSubmitForm>
                  </th>
                ))}
                <th className="py-2 pr-3 min-w-[320px]">Jahresziel (rechts)</th>
              </tr>
            </thead>
            <tbody>
              {visibleDirections.length === 0 ? (
                <tr>
                  <td
                    colSpan={2 + data.challenges.length}
                    className="py-6 text-sm text-zinc-600"
                  >
                    {data.directions.length === 0
                      ? "Keine strategischen Sto\u00DFrichtungen im Dashboard."
                      : "Keine Sto\u00DFrichtung mit Status Genehmigt, Aktiv oder Pausiert \u2014 diese Matrix zeigt nur diese Status."}
                  </td>
                </tr>
              ) : null}
              {visibleDirections.map((direction) => {
                const targets = targetsByDirection.get(direction.id) ?? [];
                const primaryTarget =
                  targets.find((target) => target.is_primary) ??
                  [...targets].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] ??
                  null;
                const additionalTargets = primaryTarget
                  ? targets.filter((target) => target.id !== primaryTarget.id)
                  : targets;
                const dirStatus = normalizeStrategicDirectionStatus(direction.status);

                return (
                  <tr key={direction.id} className="border-b border-zinc-100 align-top">
                    <td className="py-3 pr-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium leading-none text-zinc-600"
                          title="Status der Sto\u00DFrichtung"
                        >
                          {STRATEGIC_DIRECTION_STATUS_LABELS_DE[dirStatus]}
                        </span>
                      </div>
                      <form action={updateDirection} className="brand-surface p-2 space-y-2">
                        <input type="hidden" name="direction_id" value={direction.id} />
                        <input name="title" defaultValue={direction.title} className="w-full rounded border border-zinc-300 px-2 py-1 text-xs" />
                        <div className="grid grid-cols-2 gap-1">
                          <select name="owner_membership_id" defaultValue={direction.owner_membership_id ?? ""} className="rounded border border-zinc-300 px-1 py-1 text-xs">
                            <option value="">Verantwortliche Person</option>
                            {uniqueOwnerOptions.map((owner) => (
                              <option key={owner.membership_id} value={owner.membership_id}>
                                {owner.full_name}
                              </option>
                            ))}
                          </select>
                          <input name="grouping" defaultValue={direction.grouping ?? ""} placeholder="Gruppierung" className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <select
                            name="status"
                            defaultValue={normalizeStrategicDirectionStatus(direction.status)}
                            className="rounded border border-zinc-300 px-1 py-1 text-xs"
                          >
                            {STRATEGIC_DIRECTION_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STRATEGIC_DIRECTION_STATUS_LABELS_DE[s]}
                              </option>
                            ))}
                          </select>
                          <input name="display_order" type="number" defaultValue={visibleDirections.findIndex((item) => item.id === direction.id) + 1} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          
                          Priorität (Score): {Number(direction.priority ?? 0).toFixed(2)} — wird aus Bewertungen im Strategiezyklus neu berechnet, wenn du die Zeile speicherst.
                        </p>
                        <div className="text-xs text-zinc-500">
                          Verantwortlich: {direction.owner_membership_id ? ownerNameByMembership.get(direction.owner_membership_id) ?? "-" : "nicht gesetzt"}
                        </div>
                        <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">Zeile speichern</button>
                      </form>
                      <ConfirmBeforeSubmitForm
                        action={removeDirectionFromDashboard}
                        className="mt-1"
                        title="Stoßrichtung aus dem Dashboard entfernen?"
                        description="Die Zeile wird aus dieser Matrix genommen; Zellenbewertungen zu dieser Richtung können entfallen."
                        confirmLabel="Entfernen"
                      >
                        <input type="hidden" name="direction_id" value={direction.id} />
                        <button type="submit" disabled={!canWrite} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50">
                          Aus Dashboard entfernen
                        </button>
                      </ConfirmBeforeSubmitForm>
                      <form action={addComment} className="mt-2 space-y-1">
                        <input type="hidden" name="object_type" value="direction" />
                        <input type="hidden" name="object_id" value={direction.id} />
                        <input name="comment_text" placeholder="Kommentar zur Sto\u00DFrichtung" className="w-full rounded border border-zinc-300 px-2 py-1 text-xs" />
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
                                <option value="low">niedrig</option>
                                <option value="medium">mittel</option>
                                <option value="high">hoch</option>
                              </select>
                              <input
                                name="note"
                                defaultValue={cell?.note ?? ""}
                                placeholder="Notiz zur Beziehung"
                                className="w-full rounded border border-zinc-300 px-1 py-1 text-xs"
                              />
                              <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">
                                {cell ? "Beziehung aktualisieren" : "Beziehung anlegen"}
                              </button>
                            </form>
                            {cell ? (
                              <ConfirmBeforeSubmitForm
                                action={deleteCell}
                                title="Matrix-Beziehung löschen?"
                                description="Die Zuordnung zwischen dieser Stoßrichtung und dieser Herausforderung inkl. Notizen wird entfernt."
                                confirmLabel="Löschen"
                              >
                                <input type="hidden" name="direction_id" value={direction.id} />
                                <input type="hidden" name="challenge_id" value={challenge.id} />
                                <button type="submit" disabled={!canWrite} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50">
                                  Beziehung loeschen
                                </button>
                              </ConfirmBeforeSubmitForm>
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
                            <button type="submit" disabled={!canWrite} className="brand-btn px-2 py-1 text-xs">Hauptziel speichern</button>
                          </form>
                        ) : (
                          <p className="text-xs text-zinc-500">Noch kein Jahresziel vorhanden.</p>
                        )}

                        <form action={createAnnualTarget} className="space-y-1">
                          <input type="hidden" name="direction_id" value={direction.id} />
                          <input name="title" placeholder="Neues Jahresziel" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                          <div className="grid grid-cols-3 gap-1">
                            <input name="baseline" type="number" step="0.01" defaultValue={0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                            <input name="current_measure" type="number" step="0.01" defaultValue={0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                            <input name="progress_percent" type="number" step="0.1" min={0} max={100} defaultValue={0} className="rounded border border-zinc-300 px-1 py-1 text-xs" />
                          </div>
                          <input name="comment" placeholder="Kommentar" className="w-full rounded border border-zinc-300 px-1 py-1 text-xs" />
                          <button type="submit" disabled={!canWrite} className="brand-btn-secondary px-2 py-1 text-xs">Jahresziel anlegen</button>
                        </form>

                        {additionalTargets.length > 0 ? (
                          <Link
                            href={`${strategyMatrixBaseHref}&drawer_direction_id=${direction.id}`}
                            className="inline-block rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                          >
                            Weitere Jahresziele ({additionalTargets.length}) in der Seitenansicht
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
              Jahresziele im Detail: {drawerDirection.title}
            </h2>
            <Link href={strategyMatrixBaseHref} className="rounded border border-zinc-300 px-2 py-1 text-xs">
              Schliessen
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {drawerTargets.length === 0 ? (
              <p className="text-sm text-zinc-600">Keine Jahresziele vorhanden.</p>
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
                      {target.is_primary ? "Hauptziel" : "Als Hauptziel setzen"}
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
