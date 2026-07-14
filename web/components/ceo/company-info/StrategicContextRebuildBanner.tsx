"use client";



import Link from "next/link";

import { useRouter, useSearchParams } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import type { StrategicContextRebuildPollState } from "@/app/api/analysis-background-jobs/strategic-context-status/route";

import { SentinelStatusBanner } from "@/components/ceo/SentinelStatusBanner";

import { formatMissingCompanyProfileFields } from "@/lib/strategy-cycle/strategic-context-rebuild-shared";



const POLL_INTERVAL_MS = 1_500;

const INITIAL_DELAY_MS = 400;

const MAX_POLL_MS = 120_000;

const NONE_GRACE_MS = 25_000;

const SAVE_SUCCESS_KEYS = new Set(["company-kennzahlen-saved", "strategy-reference-saved"]);



function sleep(ms: number, signal?: AbortSignal): Promise<void> {

  return new Promise((resolve, reject) => {

    if (signal?.aborted) {

      reject(new DOMException("Aborted", "AbortError"));

      return;

    }

    const timer = setTimeout(() => resolve(), ms);

    signal?.addEventListener(

      "abort",

      () => {

        clearTimeout(timer);

        reject(new DOMException("Aborted", "AbortError"));

      },

      { once: true }

    );

  });

}



async function fetchRebuildPollState(signal: AbortSignal): Promise<StrategicContextRebuildPollState | null> {

  const res = await fetch("/api/analysis-background-jobs/strategic-context-status", {

    cache: "no-store",

    signal,

  });

  if (!res.ok) return null;

  const body = (await res.json()) as { state?: StrategicContextRebuildPollState };

  return body.state ?? null;

}



type StrategicContextRebuildBannerProps = {

  initialRebuildActive: boolean;

};



export function StrategicContextRebuildBanner({

  initialRebuildActive,

}: StrategicContextRebuildBannerProps) {

  const router = useRouter();

  const searchParams = useSearchParams();

  const abortRef = useRef<AbortController | null>(null);

  const [isRebuilding, setIsRebuilding] = useState(initialRebuildActive);

  const [pollTimedOut, setPollTimedOut] = useState(false);



  const success = searchParams.get("success");

  const sentinel = searchParams.get("sentinel");

  const sentinelReason = searchParams.get("sentinel_reason");

  const sentinelMissing = searchParams.get("sentinel_missing");



  const expectRebuild =

    initialRebuildActive ||

    sentinel === "queued" ||

    (success != null && SAVE_SUCCESS_KEYS.has(success) && sentinel !== "skipped");



  useEffect(() => {

    setIsRebuilding(initialRebuildActive || expectRebuild);

  }, [expectRebuild, initialRebuildActive]);



  useEffect(() => {

    if (!expectRebuild) return;



    abortRef.current?.abort();

    const controller = new AbortController();

    abortRef.current = controller;

    setPollTimedOut(false);



    const run = async () => {

      const started = Date.now();

      try {

        await sleep(INITIAL_DELAY_MS, controller.signal);



        while (Date.now() - started < MAX_POLL_MS) {

          const state = await fetchRebuildPollState(controller.signal);



          if (state === "pending") {

            setIsRebuilding(true);

            await sleep(POLL_INTERVAL_MS, controller.signal);

            continue;

          }



          if (state === "completed") {

            setIsRebuilding(false);

            router.refresh();

            return;

          }



          if (state === "failed") {

            setIsRebuilding(false);

            setPollTimedOut(true);

            router.refresh();

            return;

          }



          if (Date.now() - started >= NONE_GRACE_MS) {

            setIsRebuilding(false);

            if (sentinel === "queued") setPollTimedOut(true);

            return;

          }



          await sleep(POLL_INTERVAL_MS, controller.signal);

        }



        setIsRebuilding(false);

        setPollTimedOut(true);

      } catch (e) {

        if (e instanceof Error && e.name === "AbortError") return;

      }

    };



    void run();



    return () => {

      controller.abort();

    };

  }, [expectRebuild, router, sentinel]);



  if (sentinel === "skipped") {

    if (sentinelReason === "llm_disabled") {

      return (

        <SentinelStatusBanner variant="amber">

          Sentinel✨ Zusammenfassung wurde nicht gestartet: LLM ist deaktiviert oder «Ziele-Bewertung» ist in der

          Systemkonfiguration aus. Bitte unter LLM-Nutzung aktivieren.

        </SentinelStatusBanner>

      );

    }

    if (sentinelReason === "profile_incomplete") {

      const missing = sentinelMissing

        ? formatMissingCompanyProfileFields(sentinelMissing.split(",").filter(Boolean))

        : "Pflichtfelder in den Kennwerten";

      return (

        <SentinelStatusBanner variant="amber">

          Sentinel✨ Zusammenfassung wurde nicht gestartet: Bitte zuerst alle Kennwerte ausfüllen ({missing}).

        </SentinelStatusBanner>

      );

    }

    if (sentinelReason === "budget_exceeded") {

      return (

        <SentinelStatusBanner variant="amber">

          Sentinel✨ Zusammenfassung wurde nicht gestartet: LLM-Budget erreicht.

        </SentinelStatusBanner>

      );

    }

    return (

      <SentinelStatusBanner variant="amber">

        Sentinel✨ Zusammenfassung konnte nicht gestartet werden. Bitte erneut speichern oder Support kontaktieren.

      </SentinelStatusBanner>

    );

  }



  if (isRebuilding) {

    return (

      <SentinelStatusBanner variant="sky" role="status" aria-live="polite">

        Sentinel✨ erzeugt die Zusammenfassung … Das kann einige Sekunden dauern. Ergebnis im Tab{" "}

        <Link href="/unternehmensinfo?l2=sentinel-zusammenfassung" className="font-medium underline">

          Sentinel✨ Zusammenfassung

        </Link>

        .

      </SentinelStatusBanner>

    );

  }



  if (pollTimedOut) {

    return (

      <SentinelStatusBanner variant="amber">

        Sentinel✨-Job wurde nicht abgeschlossen. Bitte Tab{" "}

        <Link href="/unternehmensinfo?l2=sentinel-zusammenfassung" className="font-medium underline">

          Sentinel✨ Zusammenfassung

        </Link>{" "}

        prüfen oder erneut speichern.

      </SentinelStatusBanner>

    );

  }



  return null;

}


