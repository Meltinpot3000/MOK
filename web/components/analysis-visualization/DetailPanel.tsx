"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEffect, useState } from "react";
import type { VisualizationEdge, VisualizationNode } from "@/components/analysis-visualization/types";

type DetailPanelProps = {
  selectedNode: VisualizationNode | null;
  selectedEdge: VisualizationEdge | null;
  incomingEdgeCount: number;
  outgoingEdgeCount: number;
  challengeMapped: boolean;
  canWrite: boolean;
  onUpdateEdge: (payload: { id: string; linkType: string; strength: number; comment: string }) => Promise<void>;
  onDeleteEdge: (edge: VisualizationEdge) => Promise<void>;
  mode?: "panel" | "overlay";
  onClose?: () => void;
};

export function DetailPanel({
  selectedNode,
  selectedEdge,
  incomingEdgeCount,
  outgoingEdgeCount,
  challengeMapped,
  canWrite,
  onUpdateEdge,
  onDeleteEdge,
  mode = "panel",
  onClose,
}: DetailPanelProps) {
  const [editLinkType, setEditLinkType] = useState("related_to");
  const [editStrength, setEditStrength] = useState(3);
  const [editComment, setEditComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!selectedEdge) return;
    setEditLinkType(selectedEdge.linkType);
    setEditStrength(selectedEdge.strength);
    setEditComment(selectedEdge.comment ?? "");
    setStatus(null);
  }, [selectedEdge]);

  const tri = selectedEdge?.triScores ?? null;

  return (
    <>
    <aside
      className={`space-y-3 rounded-md border border-zinc-200 bg-white p-3 shadow-sm ${
        mode === "overlay" ? "max-w-[360px]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Detail</h3>
        {mode === "overlay" && onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 bg-white px-2 py-0.5 text-xs text-zinc-700"
          >
            Schliessen
          </button>
        ) : null}
      </div>
      {!selectedNode && !selectedEdge ? (
        <p className="text-xs text-zinc-600">
          Knoten oder Verbindung auswaehlen, um Details und strategische Ableitung zu sehen.
        </p>
      ) : null}

      {selectedNode ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-zinc-900">{selectedNode.label}</p>
          <p className="text-xs text-zinc-600">
            Typ: {selectedNode.analysisType} {selectedNode.subType ? `/${selectedNode.subType}` : ""}
          </p>
          <p className="text-xs text-zinc-600">
            Wirkung {selectedNode.impact}/5 | Unsicherheit {selectedNode.uncertainty}/5 | Qualitaet {selectedNode.qualityScore}
          </p>
          <p className="text-xs text-zinc-600">
            Einfluss: {incomingEdgeCount} eingehend / {outgoingEdgeCount} ausgehend
          </p>
          <p className="text-xs text-zinc-600">
            Cluster: {selectedNode.clusterLabel ?? "isoliert"}
          </p>
          <p className="text-xs text-zinc-600">
            Herausforderungs-Zuordnung: {challengeMapped ? "vorhanden" : "offen"}
          </p>
          {selectedNode.description ? (
            <p className="mt-2 text-xs text-zinc-600">{selectedNode.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-600">
            Strategischer Hinweis: Nutze Knoten mit hoher Wirkung und vielen ausgehenden Kanten als Kandidaten fuer Herausforderungen.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={`/strategy-cycle?tab=${selectedNode.analysisType}#entry-${selectedNode.id}`}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              Zum Eintrag springen
            </a>
            <a
              href="/strategy-matrix"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
            >
              Zur Matrix ableiten
            </a>
          </div>
        </div>
      ) : null}

      {selectedEdge ? (
        <div className="space-y-1 rounded border border-zinc-200 bg-zinc-50 p-2">
          <p className="text-xs font-semibold text-zinc-900">Verbindung</p>
          <p className="text-xs text-zinc-600">Typ: {selectedEdge.linkType}</p>
          <p className="text-xs text-zinc-600">
            Staerke {selectedEdge.strength}/5 | Vertrauen {Math.round(selectedEdge.confidence * 100)}%
          </p>
          {tri ? (
            <p className="text-xs text-zinc-600">
              Naehe {Math.round(tri.proximityScore * 100)}% | Unterstuetzung{" "}
              {Math.round(tri.supportScore * 100)}% | Abstossung {Math.round(tri.repulsionScore * 100)}%
            </p>
          ) : null}
          {selectedEdge.comment ? <p className="text-xs text-zinc-600">{selectedEdge.comment}</p> : null}
          {selectedEdge.createdAt ? (
            <p className="text-xs text-zinc-500">
              Erstellt: {new Date(selectedEdge.createdAt).toLocaleString("de-CH")}
            </p>
          ) : null}
          {selectedEdge.updatedAt ? (
            <p className="text-xs text-zinc-500">
              Letzte Aktualisierung: {new Date(selectedEdge.updatedAt).toLocaleString("de-CH")}
            </p>
          ) : null}
          {selectedEdge.history && selectedEdge.history.length > 0 ? (
            <div className="mt-2 rounded border border-zinc-200 bg-white p-2">
              <p className="mb-1 text-xs font-medium text-zinc-700">Historie (neueste zuerst)</p>
              <div className="space-y-1">
                {[...selectedEdge.history]
                  .slice(-5)
                  .reverse()
                  .map((item, index) => (
                    <p key={`${item.at}-${index}`} className="text-xs text-zinc-600">
                      {new Date(item.at).toLocaleString("de-CH")}: {item.previous.linkType}→{item.next.linkType},{" "}
                      S {item.previous.strength}→{item.next.strength}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}
          <div className="mt-2 space-y-2 border-t border-zinc-200 pt-2">
            <p className="text-xs font-medium text-zinc-700">Verbindung bearbeiten</p>
            <select
              value={editLinkType}
              onChange={(event) => setEditLinkType(event.target.value)}
              disabled={!canWrite || busy}
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
            >
              <option value="related_to">ist verbunden mit</option>
              <option value="causes">verursacht</option>
              <option value="supports">unterstuetzt</option>
              <option value="contradicts">widerspricht</option>
              <option value="amplifies">verstaerkt</option>
              <option value="depends_on">haengt ab von</option>
              <option value="duplicates">dupliziert</option>
            </select>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={editStrength}
                onChange={(event) => setEditStrength(Number(event.target.value))}
                disabled={!canWrite || busy}
                className="min-w-0 flex-1 accent-[var(--brand-primary)]"
              />
              <span className="w-10 text-right text-xs text-zinc-700">{editStrength}/5</span>
            </div>
            <textarea
              rows={3}
              value={editComment}
              onChange={(event) => setEditComment(event.target.value)}
              disabled={!canWrite || busy}
              placeholder="Kommentar (optional)"
              className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs"
            />
            {status ? <p className="text-xs text-zinc-600">{status}</p> : null}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!canWrite || busy}
                onClick={async () => {
                  if (!selectedEdge) return;
                  setBusy(true);
                  setStatus("Speichere...");
                  try {
                    await onUpdateEdge({
                      id: selectedEdge.id,
                      linkType: editLinkType,
                      strength: editStrength,
                      comment: editComment,
                    });
                    setStatus("Verbindung aktualisiert.");
                  } catch {
                    setStatus("Aktualisierung fehlgeschlagen.");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
              >
                Speichern
              </button>
              <button
                type="button"
                disabled={!canWrite || busy}
                onClick={() => setDeleteConfirmOpen(true)}
                className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700"
              >
                Loeschen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
    {deleteConfirmOpen && selectedEdge ? (
      <ConfirmDialog
        title="Verbindung löschen?"
        description="Die Verbindung wird dauerhaft entfernt."
        confirmLabel="Löschen"
        pending={busy}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          const edge = selectedEdge;
          setDeleteConfirmOpen(false);
          void (async () => {
            setBusy(true);
            setStatus("Loesche...");
            try {
              await onDeleteEdge(edge);
              setStatus("Verbindung geloescht.");
            } catch {
              setStatus("Loeschen fehlgeschlagen.");
            } finally {
              setBusy(false);
            }
          })();
        }}
      />
    ) : null}
    </>
  );
}
