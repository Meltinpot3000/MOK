import Link from "next/link";
import { redirect } from "next/navigation";
import { StrategyNetworkFaq } from "@/components/ceo/StrategyNetworkFaq";
import { StrategyReferenceNetwork } from "@/components/ceo/StrategyReferenceNetwork";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { getReferenceNetworkGraph, REFERENCE_FAQ } from "@/lib/strategy-network/reference-model";

export default async function StrategienetzwerkPage() {
  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const access = await getSidebarAccessContext("strategy-network");
  if (access.state !== "ok") redirect("/no-access");

  const graph = getReferenceNetworkGraph();

  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Systematik &amp; Verknüpfungen
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">Strategienetzwerk</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Referenzmodell der Systematik: <strong>Elementtypen</strong> und{" "}
          <strong>Beziehungsarten</strong> in Strategie-, Umsetzungs- und OKR-Ebene sowie Review. Für
          Herausforderungen leitet die Software daraus ein{" "}
          <strong>dreiteiliges Profil</strong> ab (Adressierung, Kohärenz, Umsetzung). Neu ist der
          Governance-Layer <strong>„Keine aktiven OKRs ohne gültige Jahresziele“</strong> mit
          Gate 1 (Jahresziele vorhanden) und Gate 2 (Objective↔Jahresziel oder Ausnahme).
        </p>
        <p className="text-xs text-zinc-500">
          Fachliche Tiefe:{" "}
          <Link href="/user-manual#begriffe" className="font-medium text-zinc-800 underline">
            User Manual – Zentrale Begriffe
          </Link>
          {" · "}
          <Link href="/strategy-cycle" className="font-medium text-zinc-800 underline">
            Strategiezyklus
          </Link>
          {" · "}
          <Link href="/reviews" className="font-medium text-zinc-800 underline">
            Reviewzyklus
          </Link>
          {" · "}
          <Link href="/okr/dashboard" className="font-medium text-zinc-800 underline">
            OKR-Zyklus
          </Link>
        </p>
      </header>

      <StrategyReferenceNetwork graph={graph} />

      <StrategyNetworkFaq items={REFERENCE_FAQ} />
    </main>
  );
}
