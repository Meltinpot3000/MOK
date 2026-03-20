"use client";

import { useState } from "react";
import { LINK_TYPE_OPTIONS } from "@/lib/analysis-item-link/link-types";
import type { PositionedNode } from "@/components/analysis-visualization/types";

type CreateLinkDialogProps = {
  sourceNode: PositionedNode;
  targetNode: PositionedNode;
  anchor: { x: number; y: number };
  onConfirm: (payload: { linkType: string; strength: number; comment: string | null }) => void | Promise<void>;
  onCancel: () => void;
};

export function CreateLinkDialog({
  sourceNode,
  targetNode,
  anchor,
  onConfirm,
  onCancel,
}: CreateLinkDialogProps) {
  const [linkType, setLinkType] = useState("related_to");
  const [strength, setStrength] = useState(3);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setError(null);
    setLoading(true);
    try {
      await onConfirm({ linkType, strength, comment: comment.trim() || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="absolute z-30 w-72 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg"
      style={{
        left: Math.max(8, anchor.x),
        top: Math.max(8, anchor.y),
      }}
    >
      <h4 className="mb-3 text-sm font-semibold text-zinc-900">Verbindung erstellen</h4>
      <p className="mb-3 text-xs text-zinc-600">
        <span className="font-medium">{sourceNode.label}</span>
        <span className="mx-1">→</span>
        <span className="font-medium">{targetNode.label}</span>
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-600">Verbindungstyp</span>
          <select
            value={linkType}
            onChange={(e) => setLinkType(e.target.value)}
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          >
            {LINK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-xs text-zinc-600">
            <span>Stärke</span>
            <span className="text-zinc-700">{strength}/5</span>
          </span>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="w-full accent-[var(--brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-600">Kommentar (optional)</span>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="z.B. Begründung"
            className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={loading}
          className="rounded bg-[var(--brand-primary)] px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Wird gespeichert…" : "Erstellen"}
        </button>
      </div>
    </div>
  );
}
