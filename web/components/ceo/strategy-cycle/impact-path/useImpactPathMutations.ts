"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  impactPathStatusMessage,
  type ImpactPathMutationResult,
} from "@/lib/strategy-cycle/impact-path-mutation";

export type ImpactPathStatusBanner = { type: "success" | "error"; text: string };

type ImpactPathMutationAction = (formData: FormData) => Promise<ImpactPathMutationResult | void>;

export function useImpactPathMutations() {
  const router = useRouter();
  const [statusBanner, setStatusBanner] = useState<ImpactPathStatusBanner | null>(null);
  const [isPending, setIsPending] = useState(false);

  const runMutation = useCallback(
    async (action: ImpactPathMutationAction, formData: FormData) => {
      if (isPending) return;
      formData.set("_noRedirect", "1");
      const scrollY = window.scrollY;
      setIsPending(true);
      try {
        const result = await action(formData);
        if (result && !result.ok) {
          setStatusBanner(impactPathStatusMessage(result.error, null));
          return;
        }
        if (result?.ok) {
          setStatusBanner(impactPathStatusMessage(null, result.success));
        }
        router.refresh();
        const restoreScroll = () => window.scrollTo({ top: scrollY, left: 0 });
        requestAnimationFrame(restoreScroll);
        for (const delay of [50, 150, 300]) {
          window.setTimeout(restoreScroll, delay);
        }
      } finally {
        setIsPending(false);
      }
    },
    [isPending, router]
  );

  const wrapAction = useCallback(
    (action: ImpactPathMutationAction) => {
      return async (formData: FormData) => runMutation(action, formData);
    },
    [runMutation]
  );

  const submitForm = useCallback(
    (action: ImpactPathMutationAction) => (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void runMutation(action, new FormData(event.currentTarget));
    },
    [runMutation]
  );

  return {
    statusBanner,
    setStatusBanner,
    isPending,
    wrapAction,
    submitForm,
    runMutation,
  };
}
