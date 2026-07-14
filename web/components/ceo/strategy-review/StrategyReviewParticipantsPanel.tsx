"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteStrategyReviewParticipantAction,
  removeStrategyReviewParticipantAction,
} from "@/app/(ceo)/okr/strategy-review-actions";
import {
  STRATEGY_REVIEW_PARTICIPANT_ROLES,
  strategyReviewParticipantRoleLabel,
  type StrategyReviewMemberOption,
  type StrategyReviewParticipant,
  type StrategyReviewParticipantRole,
} from "@/lib/strategy-review/participants";

type Props = {
  reviewId: string;
  participants: StrategyReviewParticipant[];
  memberOptions: StrategyReviewMemberOption[];
  canWrite: boolean;
};

export function StrategyReviewParticipantsPanel({
  reviewId,
  participants,
  memberOptions,
  canWrite,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [membershipId, setMembershipId] = useState("");
  const [reviewRole, setReviewRole] = useState<StrategyReviewParticipantRole>("stakeholder");

  const invitedIds = useMemo(
    () => new Set(participants.map((p) => p.membership_id)),
    [participants]
  );

  const availableOptions = useMemo(
    () => memberOptions.filter((o) => !invitedIds.has(o.membership_id)),
    [memberOptions, invitedIds]
  );

  function invite() {
    if (!membershipId) {
      setError("Bitte eine Person aus der Organisation wählen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await inviteStrategyReviewParticipantAction(
        reviewId,
        membershipId,
        reviewRole
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMembershipId("");
      router.refresh();
    });
  }

  function remove(participantId: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeStrategyReviewParticipantAction(participantId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="brand-card space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Beteiligte am Reviewzyklus</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Personen mit ihrer Rolle im Strategie-Review. Laden Sie Mitglieder der Organisation ein und
          weisen Sie die passende Review-Rolle zu.
          {!canWrite
            ? " Einladen und Entfernen erfordert Moderationsrecht."
            : ""}
        </p>
      </div>

      {participants.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
          Noch niemand eingeladen. Bitte Review-Leitung, Stakeholder und Entscheider aus der Orga
          hinzufügen.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-900">{p.display_name}</p>
                <p className="text-xs text-zinc-500">
                  Review-Rolle: {strategyReviewParticipantRoleLabel(p.review_role)}
                  {p.org_roles_label ? ` · Orga: ${p.org_roles_label}` : ""}
                </p>
              </div>
              {canWrite ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(p.id)}
                  className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Entfernen
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Person aus der Organisation
            </span>
            <select
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              disabled={pending || availableOptions.length === 0}
            >
              <option value="">
                {availableOptions.length === 0
                  ? "Keine weiteren Personen verfügbar"
                  : "Person wählen…"}
              </option>
              {availableOptions.map((o) => (
                <option key={o.membership_id} value={o.membership_id}>
                  {o.org_roles_label
                    ? `${o.display_name} · ${o.org_roles_label}`
                    : o.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
              Review-Rolle
            </span>
            <select
              value={reviewRole}
              onChange={(e) => setReviewRole(e.target.value as StrategyReviewParticipantRole)}
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
              disabled={pending}
            >
              {STRATEGY_REVIEW_PARTICIPANT_ROLES.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={pending || !membershipId}
            onClick={invite}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Einladen
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Rollen im Strategie-Review
        </h3>
        <dl className="mt-3 space-y-2.5">
          {STRATEGY_REVIEW_PARTICIPANT_ROLES.map((r) => (
            <div key={r.code} className="text-sm">
              <dt className="font-medium text-zinc-900">{r.label}</dt>
              <dd className="mt-0.5 text-zinc-600">{r.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
