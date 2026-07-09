"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { STRATEGY_REVISION_REFRESH_SUCCESS_KEYS } from "@/lib/strategy-objects/revision-status-messages";

const SUCCESS_KEYS = [
  "program-created",
  "initiative-created",
  ...STRATEGY_REVISION_REFRESH_SUCCESS_KEYS,
];
const STORAGE_KEY = "strategy-cycle-refreshed-success";

/**
 * Triggers router.refresh() when URL contains success=program-created or initiative-created.
 * Ensures fresh data is loaded after server action redirect (avoids stale RSC cache).
 */
export function RefreshOnSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const success = searchParams.get("success");
    if (!success || !SUCCESS_KEYS.includes(success)) {
      SUCCESS_KEYS.forEach((k) => sessionStorage.removeItem(`${STORAGE_KEY}-${k}`));
      return;
    }
    const key = `${STORAGE_KEY}-${success}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    router.refresh();
  }, [router, searchParams]);

  return null;
}
