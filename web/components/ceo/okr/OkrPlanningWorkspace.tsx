"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  OkrPlanningInitiativeRow,
  OkrPlanningObjectiveRow,
  OkrPlanningWorkspaceData,
  OkrResponsibleOption,
} from "@/lib/okr/planning-data";
import {
  createKeyResultAction,
  createOkrObjectiveAction,
  deleteKeyResultAction,
  deleteOkrObjectiveAction,
  setKeyResultInitiativeLinksAction,
  updateKeyResultAction,
  updateOkrObjectiveAction,
} from "@/app/(ceo)/okr-workspace/actions";

type OkrPlanningWorkspaceProps = {
  data: OkrPlanningWorkspaceData;
  cycleInstanceId: string;
  canWrite: boolean;
};

const STALE_DAYS = 30;

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function formatDeDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}

function WarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      {children}
    </span>
  );
}

export function OkrPlanningWorkspace({ data, cycleInstanceId, canWrite }: OkrPlanningWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => router.refresh();
  const [directionFilter, setDirectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [quickFind, setQuickFind] = useState("");
  const [expandedObjectiveId, setExpandedObjectiveId] = useState<string | null>(null);
  const [expandedKrId, setExpandedKrId] = useState<string | null>(null);

  const directionOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const row of data.initiatives) {
      if (row.strategicDirectionId) ids.add(row.strategicDirectionId);
    }
    return [...ids].sort((a, b) =>
      (data.strategicDirections.find((d) => d.id === a)?.title ?? a).localeCompare(
        data.strategicDirections.find((d) => d.id === b)?.title ?? b,
        "de"
      )
    );
  }, [data.initiatives, data.strategicDirections]);

  const ownerOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const row of data.initiatives) {
      if (row.ownerMembershipId && row.ownerDisplayName) {
        m.set(row.ownerMembershipId, row.ownerDisplayName);
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "de"));
  }, [data.initiatives]);

  const quickLower = quickFind.trim().toLowerCase();

  const filteredInitiatives = useMemo(() => {
    return data.initiatives.filter((row) => {
      if (directionFilter && row.strategicDirectionId !== directionFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (ownerFilter && row.ownerMembershipId !== ownerFilter) return false;
      if (quickLower && !row.title.toLowerCase().includes(quickLower)) return false;
      return true;
    });
  }, [data.initiatives, directionFilter, statusFilter, ownerFilter, quickLower]);

  const selectedOkrCycleEndDate = useMemo(() => {
    const id = data.selectedOkrCycleId;
    if (!id) return null;
    return data.okrCycles.find((c) => c.id === id)?.end_date ?? null;
  }, [data.okrCycles, data.selectedOkrCycleId]);

  const filteredOkrObjectives = useMemo(() => {
    if (!quickLower) return data.okrObjectives;
    return data.okrObjectives.filter((obj) => {
      if (obj.title.toLowerCase().includes(quickLower)) return true;
      if (obj.keyResults.some((kr) => kr.title.toLowerCase().includes(quickLower))) return true;
      return obj.keyResults.some((kr) =>
        kr.linkedInitiativeTitles.some((t) => t.toLowerCase().includes(quickLower))
      );
    });
  }, [data.okrObjectives, quickLower]);

  const onOkrCycleChange = (okrCycleId: string) => {
    const params = new URLSearchParams();
    params.set("okrCycle", okrCycleId);
    router.push(`/okr/planning?${params.toString()}`);
  };

  return (
    <div className="space-y-3">
      <div className="brand-card p-4">
        <label className="block text-xs font-medium text-zinc-600">
          Suche (zusätzlich zu Filtern)
          <input
            type="search"
            value={quickFind}
            onChange={(e) => setQuickFind(e.target.value)}
            placeholder="OKR-Objective-, KR- oder Initiativ-Titel…"
            className="mt-1 w-full max-w-xl rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">Execution-Kontext</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Initiativen aus dem Review-Zyklus — Umsetzung und Review-Stand als Input für die OKR-Planung.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs text-zinc-600">
            Stoßrichtung
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {directionOptions.map((id) => (
                <option key={id} value={id}>
                  {data.strategicDirections.find((d) => d.id === id)?.title ?? id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Status
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {["draft", "planned", "active", "at_risk", "on_hold", "completed", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-zinc-600">
            Owner
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">Alle</option>
              {ownerOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ul className="mt-4 space-y-2">
          {filteredInitiatives.length === 0 ? (
            <li className="text-sm text-zinc-600">Keine Initiativen für die Filter.</li>
          ) : (
            filteredInitiatives.map((row) => (
              <InitiativeContextCard key={row.id} row={row} />
            ))
          )}
        </ul>
      </section>

      <section className="brand-card p-6">
        <h2 className="text-lg font-semibold text-zinc-900">OKR-Builder</h2>
        <p className="mt-1 text-sm text-zinc-600">
          OKR-Objectives und Key Results für den gewählten Zeitraum. Die{" "}
          <span className="font-medium text-zinc-800">führende Stoßrichtung</span> legen Sie am Objective fest;
          Verknüpfungen zu{" "}
          <span className="font-medium text-zinc-800">Initiativen</span> erfolgen im System pro{" "}
          <span className="font-medium text-zinc-800">Key Result</span>: jeweilige KR-Zeile anklicken und aufklappen,
          dort Bereich „Unterstützende Initiativen“.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950">
          <span className="font-medium">Initiative ↔ Key Result verknüpfen:</span> Im Objective die{" "}
          <span className="font-medium">KR-Überschrift</span> anklicken (aufklappen). Unten im Bereich{" "}
          <span className="font-medium">„Unterstützende Initiativen“</span> die passenden Initiativen{" "}
          <span className="font-medium">ankreuzen</span> und{" "}
          <span className="font-medium">„Verknüpfungen speichern“</span> wählen — die gelben Hinweise in beiden Spalten
          verschwinden danach.
        </p>

        {data.okrCycles.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            Kein OKR-Zeitraum für diesen Zyklus angelegt. Legen Sie zuerst einen OKR-Zyklus an (z. B. über
            Administration / Datenpflege).
          </p>
        ) : (
          <>
            <label className="mt-4 block text-xs font-medium text-zinc-600">
              OKR-Zeitraum
              <select
                className="mt-1 w-full max-w-md rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                value={data.selectedOkrCycleId ?? ""}
                onChange={(e) => onOkrCycleChange(e.target.value)}
              >
                {data.okrCycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {data.selectedOkrCycleId && canWrite ? (
              <CreateOkrObjectiveForm
                cycleInstanceId={cycleInstanceId}
                okrCycleId={data.selectedOkrCycleId}
                directions={data.strategicDirections}
                responsibles={data.responsibles}
                pending={pending}
                startTransition={startTransition}
                onSuccess={refresh}
              />
            ) : null}

            <ul className="mt-6 space-y-4">
              {filteredOkrObjectives.length === 0 ? (
                <li className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                  {!data.selectedOkrCycleId ? (
                    "Kein Zeitraum gewählt."
                  ) : data.okrObjectives.length === 0 ? (
                    <>
                      <span className="font-medium text-zinc-900">Noch kein OKR-Objective in diesem Zeitraum.</span>{" "}
                      Bitte zuerst das Formular{" "}
                      <span className="font-medium text-zinc-900">„Neues OKR-Objective“</span> direkt oben in diesem
                      Kasten ausfüllen und anlegen. Anschließend erscheint eine Karte mit Ihrem Ziel —{" "}
                      <span className="font-medium text-zinc-900">unter „Key Results“</span> finden Sie dann{" "}
                      <span className="font-medium text-zinc-900">„Key Result hinzufügen“</span>.
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-zinc-900">Keine Treffer für die Suche.</span> Leeren Sie das
                      Suchfeld oben („Suche (zusätzlich zu Filtern)“), um alle Objectives wiederzusehen.
                    </>
                  )}
                </li>
              ) : (
                filteredOkrObjectives.map((obj) => (
                  <OkrObjectiveBlock
                    key={obj.id}
                    objective={obj}
                    cycleInstanceId={cycleInstanceId}
                    okrCycleEndDate={selectedOkrCycleEndDate}
                    directions={data.strategicDirections}
                    responsibles={data.responsibles}
                    initiatives={data.initiatives}
                    expanded={expandedObjectiveId === obj.id}
                    onToggleExpand={() =>
                      setExpandedObjectiveId((id) => (id === obj.id ? null : obj.id))
                    }
                    expandedKrId={expandedKrId}
                    setExpandedKrId={setExpandedKrId}
                    canWrite={canWrite}
                    pending={pending}
                    startTransition={startTransition}
                    onMutationSuccess={refresh}
                  />
                ))
              )}
            </ul>
          </>
        )}
      </section>
      </div>
    </div>
  );
}

function InitiativeContextCard({ row }: { row: OkrPlanningInitiativeRow }) {
  const stale = daysSince(row.lastReviewUpdateAt);
  const showStale = stale === null || stale > STALE_DAYS;

  return (
    <li className="brand-surface rounded-lg border border-zinc-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-zinc-900">{row.title}</p>
          <p className="mt-1 text-xs text-zinc-600">
            {row.strategicDirectionTitle ? (
              <span>Stoßrichtung: {row.strategicDirectionTitle}</span>
            ) : (
              <span className="text-zinc-500">Stoßrichtung: nicht zugeordnet</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {row.warningNoKeyResultLink ? (
            <WarningBadge>Nicht auf ein Key Result verlinkt</WarningBadge>
          ) : null}
          {showStale ? (
            <WarningBadge>Review-Update prüfen ({formatDeDate(row.lastReviewUpdateAt)})</WarningBadge>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Status: {row.status} · Fortschritt: {row.progressPercent}% · Gewicht: {row.weight}
        {row.ownerDisplayName ? ` · ${row.ownerDisplayName}` : ""}
      </p>
      {row.linkedKeyResultTitles.length > 0 ? (
        <p className="mt-1 text-xs text-zinc-600">
          Key Results: {row.linkedKeyResultTitles.join(", ")}
        </p>
      ) : null}
      {row.warningNoKeyResultLink ? (
        <p className="mt-2 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-zinc-700">
          <span className="font-medium text-zinc-800">Wo verknüpfen?</span> Auf dieser Seite im Kasten{" "}
          <span className="font-medium">„OKR-Builder“</span> zum passenden{" "}
          <span className="font-medium">Key Result</span> gehen,{" "}
          <span className="font-medium">Titel anklicken</span> (aufklappen), dort bei{" "}
          <span className="font-medium">„Unterstützende Initiativen“</span> diese Initiative{" "}
          <span className="font-medium">ankreuzen</span> und{" "}
          <span className="font-medium">„Verknüpfungen speichern“</span>.
        </p>
      ) : null}
    </li>
  );
}

function CreateOkrObjectiveForm(props: {
  cycleInstanceId: string;
  okrCycleId: string;
  directions: Array<{ id: string; title: string }>;
  responsibles: OkrResponsibleOption[];
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onSuccess: () => void;
}) {
  const { cycleInstanceId, okrCycleId, directions, responsibles, pending, startTransition, onSuccess } = props;
  return (
    <form
      className="mt-4 space-y-3 rounded-lg border border-dashed border-zinc-300 p-4"
      action={(fd) => {
        startTransition(async () => {
          const title = String(fd.get("title") ?? "").trim();
          const strategicDirectionId = String(fd.get("strategic_direction_id") ?? "").trim();
          const description = String(fd.get("description") ?? "").trim() || null;
          const ownerRaw = String(fd.get("owner_membership_id") ?? "").trim();
          const r = await createOkrObjectiveAction({
            cycleInstanceId,
            okrCycleId,
            title,
            description,
            strategicDirectionId,
            ownerMembershipId: ownerRaw || null,
          });
          if ("error" in r && r.error) window.alert(r.error);
          else onSuccess();
        });
      }}
    >
      <p className="text-sm font-medium text-zinc-800">Neues OKR-Objective</p>
      <p className="mt-1 text-xs text-zinc-500">
        Initiativen können nicht direkt am Objective gewählt werden — nach dem Anlegen eines Key Results dieses
        aufklappen und Initiativen dort zuordnen.
      </p>
      <input type="hidden" name="okr_cycle_id" value={okrCycleId} />
      <label className="block text-xs text-zinc-600">
        Titel *
        <input
          name="title"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="block text-xs text-zinc-600">
        Führende Stoßrichtung *
        <select
          name="strategic_direction_id"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          defaultValue=""
        >
          <option value="" disabled>
            Bitte wählen…
          </option>
          {directions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs text-zinc-600">
        Beschreibung
        <textarea name="description" rows={2} className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </label>
      <label className="block text-xs text-zinc-600">
        OKR-Objective-Owner
        <select
          name="owner_membership_id"
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          defaultValue=""
        >
          <option value="">—</option>
          {responsibles.map((r) => (
            <option key={r.membershipId} value={r.membershipId}>
              {r.fullName}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending || directions.length === 0}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        OKR-Objective anlegen
      </button>
    </form>
  );
}

function OkrObjectiveBlock(props: {
  objective: OkrPlanningObjectiveRow;
  cycleInstanceId: string;
  okrCycleEndDate: string | null;
  directions: Array<{ id: string; title: string }>;
  responsibles: OkrResponsibleOption[];
  initiatives: OkrPlanningInitiativeRow[];
  expanded: boolean;
  onToggleExpand: () => void;
  expandedKrId: string | null;
  setExpandedKrId: (id: string | null) => void;
  canWrite: boolean;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onMutationSuccess: () => void;
}) {
  const {
    objective,
    cycleInstanceId,
    okrCycleEndDate,
    directions,
    responsibles,
    initiatives,
    expanded,
    onToggleExpand,
    expandedKrId,
    setExpandedKrId,
    canWrite,
    pending,
    startTransition,
    onMutationSuccess,
  } = props;

  return (
    <li className="brand-surface rounded-lg border border-zinc-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-left text-sm font-semibold text-zinc-900 hover:underline"
          >
            {objective.title}
          </button>
          <p className="mt-1 text-xs text-zinc-600">
            Stoßrichtung:{" "}
            {objective.leadingStrategicDirectionTitle ?? (
              <span className="text-amber-800">nicht gesetzt</span>
            )}
            {objective.ownerDisplayName ? ` · Owner: ${objective.ownerDisplayName}` : ""}
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            className="text-xs text-red-700 hover:underline"
            onClick={() => {
              if (!window.confirm("OKR-Objective wirklich löschen?")) return;
              startTransition(async () => {
                const r = await deleteOkrObjectiveAction({
                  cycleInstanceId,
                  objectiveId: objective.id,
                });
                if ("error" in r && r.error) window.alert(r.error);
                else onMutationSuccess();
              });
            }}
          >
            Löschen
          </button>
        ) : null}
      </div>

      {expanded && canWrite ? (
        <form
          className="mt-3 space-y-2 border-t border-zinc-200 pt-3"
            action={(fd) => {
            startTransition(async () => {
              const ownerRaw = String(fd.get("owner_membership_id") ?? "").trim();
              const r = await updateOkrObjectiveAction({
                cycleInstanceId,
                objectiveId: objective.id,
                title: String(fd.get("title") ?? ""),
                description: String(fd.get("description") ?? "") || null,
                strategicDirectionId: String(fd.get("strategic_direction_id") ?? ""),
                status: String(fd.get("status") ?? "draft"),
                ownerMembershipId: ownerRaw || null,
              });
              if ("error" in r && r.error) window.alert(r.error);
              else onMutationSuccess();
            });
          }}
        >
          <label className="block text-xs text-zinc-600">
            Titel
            <input
              name="title"
              defaultValue={objective.title}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-zinc-600">
            Führende Stoßrichtung
            <select
              name="strategic_direction_id"
              defaultValue={objective.leadingStrategicDirectionId ?? ""}
              required
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {directions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            Status
            <select
              name="status"
              defaultValue={objective.status}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              {["draft", "active", "at_risk", "on_hold", "completed", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-zinc-600">
            Beschreibung
            <textarea
              name="description"
              rows={2}
              defaultValue={objective.description ?? ""}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-xs text-zinc-600">
            OKR-Objective-Owner
            <select
              name="owner_membership_id"
              defaultValue={objective.ownerMembershipId ?? ""}
              className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {responsibles.map((r) => (
                <option key={r.membershipId} value={r.membershipId}>
                  {r.fullName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          >
            Speichern
          </button>
        </form>
      ) : null}

      <div className="mt-4 border-t border-zinc-200 pt-4">
        <p className="text-sm font-semibold text-zinc-900">Key Results</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          Messgrößen zu diesem Objective — hier unten können Sie neue Key Results anlegen.
        </p>
        <ul className="mt-2 space-y-2">
          {objective.keyResults.map((kr) => (
            <KeyResultRow
              key={kr.id}
              kr={kr}
              objectiveId={objective.id}
              cycleInstanceId={cycleInstanceId}
              okrCycleEndDate={okrCycleEndDate}
              responsibles={responsibles}
              objectiveOwnerMembershipId={objective.ownerMembershipId}
              initiatives={initiatives}
              expanded={expandedKrId === kr.id}
              onToggle={() => setExpandedKrId(expandedKrId === kr.id ? null : kr.id)}
              canWrite={canWrite}
              pending={pending}
              startTransition={startTransition}
              onMutationSuccess={onMutationSuccess}
            />
          ))}
        </ul>
        {canWrite ? (
          <CreateKeyResultForm
            objectiveId={objective.id}
            cycleInstanceId={cycleInstanceId}
            pending={pending}
            startTransition={startTransition}
            onSuccess={onMutationSuccess}
          />
        ) : (
          <p className="mt-3 text-xs text-zinc-500">Nur Lesen: Key Results können in diesem Modus nicht angelegt werden.</p>
        )}
      </div>
    </li>
  );
}

function KeyResultRow(props: {
  kr: OkrPlanningObjectiveRow["keyResults"][number];
  objectiveId: string;
  cycleInstanceId: string;
  responsibles: OkrResponsibleOption[];
  objectiveOwnerMembershipId: string | null;
  initiatives: OkrPlanningInitiativeRow[];
  expanded: boolean;
  onToggle: () => void;
  canWrite: boolean;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onMutationSuccess: () => void;
}) {
  const {
    kr,
    cycleInstanceId,
    okrCycleEndDate,
    responsibles,
    objectiveOwnerMembershipId,
    initiatives,
    expanded,
    onToggle,
    canWrite,
    pending,
    startTransition,
    onMutationSuccess,
  } = props;

  const ownerLabel = kr.ownerMembershipId
    ? kr.ownerDisplayName
    : objectiveOwnerMembershipId
      ? responsibles.find((r) => r.membershipId === objectiveOwnerMembershipId)?.fullName ?? null
      : null;

  return (
    <li className="rounded-md border border-zinc-200 bg-white p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="text-left text-sm font-medium text-zinc-800 hover:underline"
        >
          <span className="mr-1 text-zinc-400" aria-hidden>
            {expanded ? "▼" : "▶"}
          </span>
          {kr.title}
          {!expanded && kr.warningNoInitiativeLink ? (
            <span className="mt-0.5 block text-xs font-normal text-amber-800">
              Zum Verknüpfen mit Initiativen aufklappen
            </span>
          ) : null}
        </button>
        <div className="flex flex-wrap gap-1">
          {kr.warningNoInitiativeLink ? (
            <WarningBadge>Keine Initiative mit diesem KR verknüpft</WarningBadge>
          ) : null}
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-600">
        {kr.metricType}: {kr.currentValue ?? "—"} / Ziel {kr.targetValue ?? "—"} ({kr.measurementUnit ?? "—"})
        {okrCycleEndDate ? (
          <span className="ml-1 text-zinc-500">
            · Fällig: {formatDeDate(okrCycleEndDate)} (Ende OKR-Zyklus)
          </span>
        ) : null}
      </p>
      {kr.linkedInitiativeTitles.length > 0 ? (
        <p className="text-xs text-zinc-600">Treiber: {kr.linkedInitiativeTitles.join(", ")}</p>
      ) : null}
      {!expanded && kr.warningNoInitiativeLink ? (
        <p className="mt-2 border-l-2 border-amber-400 pl-2 text-xs leading-relaxed text-zinc-700">
          <span className="font-medium text-zinc-800">So geht’s:</span> KR oben aufklappen, Bereich{" "}
          <span className="font-medium">„Unterstützende Initiativen“</span>: passende Initiativen ankreuzen, dann{" "}
          <span className="font-medium">„Verknüpfungen speichern“</span>.
        </p>
      ) : null}

      {expanded && canWrite ? (
        <div className="mt-2 space-y-3 border-t border-zinc-100 pt-2">
          <form
            action={(fd) => {
              startTransition(async () => {
                const ownerRaw = String(fd.get("kr_owner_membership_id") ?? "").trim();
                const r = await updateKeyResultAction({
                  keyResultId: kr.id,
                  title: String(fd.get("title") ?? ""),
                  metricType: String(fd.get("metric_type") ?? "numeric"),
                  startValue: fd.get("start_value") ? Number(fd.get("start_value")) : null,
                  targetValue: fd.get("target_value") ? Number(fd.get("target_value")) : null,
                  currentValue: fd.get("current_value") ? Number(fd.get("current_value")) : null,
                  measurementUnit: String(fd.get("measurement_unit") ?? "") || null,
                  status: String(fd.get("status") ?? "draft"),
                  ownerMembershipId: ownerRaw || null,
                });
                if ("error" in r && r.error) window.alert(r.error);
                else onMutationSuccess();
              });
            }}
            className="space-y-2"
          >
            <input name="title" defaultValue={kr.title} className="w-full rounded border px-2 py-1 text-xs" />
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-zinc-600">
                Fällig:{" "}
                <span className="font-medium text-zinc-800">
                  {okrCycleEndDate ? formatDeDate(okrCycleEndDate) : "—"}
                </span>
                <span className="text-zinc-500"> (automatisch Ende OKR-Zyklus)</span>
              </p>
              <label className="text-xs text-zinc-600">
                KR-Owner
                <select
                  name="kr_owner_membership_id"
                  defaultValue={kr.ownerMembershipId ?? ""}
                  className="ml-1 rounded border px-1 py-0.5 text-xs"
                >
                  <option value="">— (OKR-Objective-Owner)</option>
                  {responsibles.map((r) => (
                    <option key={r.membershipId} value={r.membershipId}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <select name="metric_type" defaultValue={kr.metricType} className="rounded border px-2 py-1 text-xs">
                <option value="numeric">numeric</option>
                <option value="percent">percent</option>
                <option value="boolean">boolean</option>
              </select>
              <input
                name="start_value"
                placeholder="Start"
                defaultValue={kr.startValue ?? ""}
                className="w-24 rounded border px-2 py-1 text-xs"
              />
              <input
                name="target_value"
                placeholder="Ziel"
                defaultValue={kr.targetValue ?? ""}
                className="w-24 rounded border px-2 py-1 text-xs"
              />
              <input
                name="current_value"
                placeholder="Ist"
                defaultValue={kr.currentValue ?? ""}
                className="w-24 rounded border px-2 py-1 text-xs"
              />
              <input
                name="measurement_unit"
                placeholder="Einheit"
                defaultValue={kr.measurementUnit ?? ""}
                className="w-28 rounded border px-2 py-1 text-xs"
              />
              <select name="status" defaultValue={kr.status} className="rounded border px-2 py-1 text-xs">
                {["draft", "active", "at_risk", "on_hold", "completed", "archived"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={pending} className="rounded bg-zinc-800 px-2 py-1 text-xs text-white">
              KR speichern
            </button>
          </form>

          <form
            action={(fd) => {
              startTransition(async () => {
                const selected = fd.getAll("initiative_ids") as string[];
                const r = await setKeyResultInitiativeLinksAction({
                  cycleInstanceId,
                  keyResultId: kr.id,
                  initiativeIds: selected,
                });
                if ("error" in r && r.error) window.alert(r.error);
                else onMutationSuccess();
              });
            }}
          >
            <p className="text-xs font-medium text-zinc-700">Unterstützende Initiativen</p>
            <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
              Hier legen Sie fest, welche Initiativen aus der linken Spalte dieses Key Result messbar unterstützen.
              Mehrfachauswahl möglich.
            </p>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-zinc-200 p-2">
              {initiatives.length === 0 ? (
                <span className="text-xs text-zinc-500">Keine Initiativen im Zyklus.</span>
              ) : (
                initiatives.map((i) => (
                  <label key={i.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="initiative_ids"
                      value={i.id}
                      defaultChecked={kr.linkedInitiativeIds.includes(i.id)}
                    />
                    <span>{i.title}</span>
                  </label>
                ))
              )}
            </div>
            <button type="submit" disabled={pending} className="mt-2 rounded bg-zinc-700 px-2 py-1 text-xs text-white">
              Verknüpfungen speichern
            </button>
          </form>

          <button
            type="button"
            className="text-xs text-red-700 hover:underline"
            onClick={() => {
              if (!window.confirm("Key Result löschen?")) return;
              startTransition(async () => {
                const r = await deleteKeyResultAction({ keyResultId: kr.id });
                if ("error" in r && r.error) window.alert(r.error);
                else onMutationSuccess();
              });
            }}
          >
            Key Result löschen
          </button>
        </div>
      ) : null}
    </li>
  );
}

function CreateKeyResultForm(props: {
  objectiveId: string;
  cycleInstanceId: string;
  pending: boolean;
  startTransition: (cb: () => void) => void;
  onSuccess: () => void;
}) {
  const { objectiveId, cycleInstanceId, pending, startTransition, onSuccess } = props;
  return (
    <form
      className="mt-4 space-y-2 rounded-md border border-dashed border-zinc-400 bg-zinc-50/80 p-3"
      action={(fd) => {
        startTransition(async () => {
          const r = await createKeyResultAction({
            cycleInstanceId,
            objectiveId,
            title: String(fd.get("title") ?? ""),
            metricType: String(fd.get("metric_type") ?? "numeric"),
          });
          if ("error" in r && r.error) window.alert(r.error);
          else onSuccess();
        });
      }}
    >
      <p className="text-sm font-semibold text-zinc-900">Key Result hinzufügen</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block min-w-[12rem] flex-1 text-xs text-zinc-600">
          Titel
          <input
            name="title"
            required
            placeholder="z. B. Umsatz Q2"
            className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs text-zinc-600">
          Metrik
          <select
            name="metric_type"
            defaultValue="numeric"
            className="mt-1 block rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="numeric">numeric</option>
            <option value="percent">percent</option>
            <option value="boolean">boolean</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Anlegen
        </button>
      </div>
    </form>
  );
}
