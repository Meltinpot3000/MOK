"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Scrollt zum Draft-Panel, wenn strategy_draft in der URL gesetzt ist. */
export function StrategyDraftFocus() {
  const searchParams = useSearchParams();
  const draftId = searchParams.get("strategy_draft");

  useEffect(() => {
    if (!draftId) return;
    const el = document.getElementById("strategy-object-draft-panel");
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [draftId]);

  return null;
}
