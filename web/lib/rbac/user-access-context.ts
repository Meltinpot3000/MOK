import { cache } from "react";

import {
  getAuthenticatedUserId,
  getCeoAccessContext,
  getRankedCeoAccessContexts,
  type CeoAccessContext,
} from "@/lib/ceo/queries";

import { getPermissionCodesForMembership } from "./permission-codes";

/**
 * Neutraler User-Access-Kontext fuer Sentinel/AI und andere Nicht-CEO-spezifische
 * Bereiche. Wraps die bestehende CEO-Helferschicht, um Sentinel nicht semantisch
 * an den CEO-Bereich zu koppeln.
 */
export type UserAccessContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  membershipId: string;
  roleCodes: string[];
  permissionCodes: Set<string>;
};

export type GetCurrentUserAccessContextOptions = {
  /** Optional: Userid bereits aufgeloest (vermeidet doppeltes auth.getUser()). */
  userId?: string;
  /**
   * Optional: erforderlicher Permission-Code. Wird ueber alle aktiven Memberships
   * ranked, der erste passende wird genommen. Wenn keiner passt, wird null
   * zurueckgegeben.
   */
  requireCapability?: string;
  /**
   * Optional: alle angegebenen Capabilities muessen vorhanden sein.
   * Wenn gesetzt, wird eine Membership mit voller Abdeckung gesucht.
   */
  requireAllCapabilities?: string[];
  /**
   * Optional: bei mehreren gueltigen Memberships gewinnt die mit den meisten
   * Treffern aus dieser Liste.
   */
  preferCapabilities?: string[];
};

async function buildContextForCandidate(
  candidate: CeoAccessContext
): Promise<UserAccessContext> {
  const permissionCodes = await getPermissionCodesForMembership(candidate.membershipId);
  return {
    userId: candidate.userId,
    organizationId: candidate.organizationId,
    organizationName: candidate.organizationName,
    membershipId: candidate.membershipId,
    roleCodes: candidate.roleCodes,
    permissionCodes,
  };
}

/**
 * Liefert den aktiven User-Access-Kontext (Membership) fuer den eingeloggten User.
 * - Ohne `requireCapability`: bevorzugt die hoechste Rolle (org_admin > executive > department_lead > uebrige).
 * - Mit `requireCapability`: das erste Ranked-Membership, dessen Permission-Set die Capability enthaelt.
 */
export const getCurrentUserAccessContext = cache(
  async (options?: GetCurrentUserAccessContextOptions): Promise<UserAccessContext | null> => {
    const userId = options?.userId ?? (await getAuthenticatedUserId());
    if (!userId) return null;

    const requiredAll = (options?.requireAllCapabilities ?? []).filter(Boolean);
    const prefer = new Set((options?.preferCapabilities ?? []).filter(Boolean));

    if (!options?.requireCapability && requiredAll.length === 0) {
      const ceoContext = await getCeoAccessContext(userId);
      if (!ceoContext) return null;
      return buildContextForCandidate(ceoContext);
    }

    const ranked = await getRankedCeoAccessContexts(userId);
    let best: { context: UserAccessContext; score: number; order: number } | null = null;
    let order = 0;
    for (const candidate of ranked) {
      const context = await buildContextForCandidate(candidate);
      if (options?.requireCapability && !context.permissionCodes.has(options.requireCapability)) {
        order += 1;
        continue;
      }
      if (requiredAll.some((cap) => !context.permissionCodes.has(cap))) {
        order += 1;
        continue;
      }

      if (prefer.size === 0) {
        return context;
      }

      let score = 0;
      for (const cap of prefer) {
        if (context.permissionCodes.has(cap)) score += 1;
      }
      if (!best || score > best.score || (score === best.score && order < best.order)) {
        best = { context, score, order };
      }
      order += 1;
    }
    return best?.context ?? null;
  }
);

/**
 * Liefert alle aktiven Memberships als `UserAccessContext[]` (z. B. wenn die UI
 * eine explizite Org-Auswahl anbietet). Reihenfolge wie `getRankedCeoAccessContexts`.
 */
export async function listUserAccessContexts(userId?: string): Promise<UserAccessContext[]> {
  const resolvedUserId = userId ?? (await getAuthenticatedUserId());
  if (!resolvedUserId) return [];
  const ranked = await getRankedCeoAccessContexts(resolvedUserId);
  const contexts: UserAccessContext[] = [];
  for (const candidate of ranked) {
    contexts.push(await buildContextForCandidate(candidate));
  }
  return contexts;
}

export function hasCapability(context: UserAccessContext, code: string): boolean {
  return context.permissionCodes.has(code);
}

export function requireCapability(context: UserAccessContext, code: string): void {
  if (!context.permissionCodes.has(code)) {
    throw new Error(`Missing capability: ${code}`);
  }
}
