"use client";



import type { DesignFieldsTreemapResult } from "@/lib/strategy-cycle/design-fields-treemap";

import { generateDesignFieldSuggestions } from "@/app/(ceo)/strategy-cycle/design-field-suggestion-actions";

import { SentinelStatusBanner } from "@/components/ceo/SentinelStatusBanner";

import { useEffect, useMemo, useState, useTransition } from "react";

import { DesignFieldDetailPanel } from "./DesignFieldDetailPanel";

import { DesignFieldsTreemap, defaultSelectedFieldId, type DesignFieldTreemapSelection } from "./DesignFieldsTreemap";

import type { DirectionGroupingPreview } from "./design-fields-types";

import { SuggestedDesignFieldsEditor } from "./SuggestedDesignFieldsPanel";

import { toEditableSuggestions, type EditableDesignFieldSuggestion } from "./SuggestedDesignFieldCard";



type Props = {

  data: DesignFieldsTreemapResult;

  canWrite?: boolean;

  llmSuggestionsEnabled?: boolean;

  directionGroupings?: DirectionGroupingPreview[];

};



export function DesignFieldsSection({

  data,

  canWrite = false,

  llmSuggestionsEnabled = false,

  directionGroupings = [],

}: Props) {

  const initialId = useMemo(() => defaultSelectedFieldId(data), [data]);

  const [selection, setSelection] = useState<DesignFieldTreemapSelection | null>(() =>
    initialId ? { fieldId: initialId, directionId: null } : null
  );

  const [isGenerating, startGenerate] = useTransition();

  const [suggestions, setSuggestions] = useState<EditableDesignFieldSuggestion[]>([]);

  const [unassignedDirectionIds, setUnassignedDirectionIds] = useState<string[]>([]);

  const [warningDe, setWarningDe] = useState<string | null>(null);

  const [generateError, setGenerateError] = useState<string | null>(null);



  useEffect(() => {

    if (initialId) setSelection({ fieldId: initialId, directionId: null });

  }, [initialId]);



  const selectedNode = data.nodes.find((n) => n.id === selection?.fieldId) ?? null;

  const selectedDirection =

    selectedNode && selection?.directionId

      ? selectedNode.directions.find((d) => d.directionId === selection.directionId) ?? null

      : null;



  function handleGenerate() {

    if (!llmSuggestionsEnabled) return;

    setGenerateError(null);

    startGenerate(async () => {

      const result = await generateDesignFieldSuggestions();

      if (!result.ok) {

        setGenerateError(result.error);

        return;

      }

      setSuggestions(toEditableSuggestions(result.suggestions));

      setUnassignedDirectionIds(result.unassignedDirectionIds);

      setWarningDe(result.warningDe);

    });

  }



  return (

    <article className="brand-card p-6">

      <div className="border-b border-zinc-200 pb-4">

        <div className="flex flex-wrap items-start justify-between gap-3">

          <div className="min-w-0">

            <h3 className="text-base font-semibold text-zinc-900">Strategische Designfelder</h3>

            <p className="mt-1 text-sm text-zinc-600">

              Wie sich Stoßrichtungen zu strategischen Handlungsfeldern verdichten — Größe zeigt Gewicht,

              Farbe zeigt Verknüpfungsqualität.

            </p>

            <p className="mt-2 text-sm text-zinc-700">{data.summaryFinding}</p>

            {data.summaryRecommendation ? (

              <p className="mt-1 text-sm text-zinc-600">{data.summaryRecommendation}</p>

            ) : null}

          </div>

          {canWrite ? (

            <button

              type="button"

              disabled={!llmSuggestionsEnabled || isGenerating}

              onClick={handleGenerate}

              className="brand-btn-secondary shrink-0 px-4 py-2 text-sm disabled:opacity-50"

            >

              {isGenerating ? "Sentinel✨ arbeitet…" : "Sentinel✨-Ausarbeitung"}

            </button>

          ) : null}

        </div>



        <div className="mt-3 space-y-3">

          {canWrite && !llmSuggestionsEnabled ? (

            <SentinelStatusBanner variant="amber">

              Sentinel✨ Designfeld-Vorschläge wurden nicht gestartet: LLM ist deaktiviert oder das Feature

              «design_field_suggestions» ist in der Systemkonfiguration aus.

            </SentinelStatusBanner>

          ) : null}



          {isGenerating ? (

            <SentinelStatusBanner variant="sky" role="status" aria-live="polite">

              Sentinel✨ erzeugt Designfeld-Vorschläge … Das kann einige Sekunden dauern. Anschließend können

              Sie die Vorschläge anpassen und übernehmen.

            </SentinelStatusBanner>

          ) : null}



          {generateError ? (

            <SentinelStatusBanner variant="amber">

              Sentinel✨ konnte keine Vorschläge liefern: {generateError}

            </SentinelStatusBanner>

          ) : null}

        </div>

      </div>



      <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">

        <div className="min-w-0">

          <DesignFieldsTreemap

            data={data}

            selection={selection}

            onSelectField={(fieldId) => setSelection({ fieldId, directionId: null })}

            onSelectDirection={(fieldId, directionId) =>

              setSelection({ fieldId, directionId })

            }

          />

        </div>

        <DesignFieldDetailPanel node={selectedNode} selectedDirection={selectedDirection} />

      </div>



      {canWrite ? (

        <SuggestedDesignFieldsEditor

          suggestions={suggestions}

          unassignedDirectionIds={unassignedDirectionIds}

          warningDe={warningDe}

          directions={directionGroupings}

          onSuggestionsChange={setSuggestions}

          onApplied={() => {

            setSuggestions([]);

            setUnassignedDirectionIds([]);

            setWarningDe(null);

          }}

        />

      ) : null}

    </article>

  );

}


