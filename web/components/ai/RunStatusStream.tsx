"use client";

import type { ChatStreamEvent } from "./use-chat-stream";

const STATUS_LABELS: Record<string, string> = {
  starting: "Starte...",
  loading_policy: "Lade Tenant-Policy",
  creating_run: "Erstelle Agent-Run",
  planning: "Sentinel Core plant",
  validating_plan: "Pruefe Plan",
  executing_tools: "Fuehre Tools aus",
  assembling_context: "Stelle Kontext zusammen",
  synthesizing: "Formuliere Antwort",
  completed: "Abgeschlossen",
  error: "Fehler",
  blocked: "Blockiert",
  cancelled: "Abgebrochen",
};

export function RunStatusStream({
  status,
  events,
  error,
}: {
  status: string;
  events: ChatStreamEvent[];
  error: string | null;
}) {
  const toolEvents = events.filter(
    (e): e is Extract<ChatStreamEvent, { type: "tool_started" | "tool_completed" }> =>
      e.type === "tool_started" || e.type === "tool_completed"
  );
  const completedById = new Map<string, Extract<ChatStreamEvent, { type: "tool_completed" }>>();
  for (const e of toolEvents) {
    if (e.type === "tool_completed") completedById.set(e.stepId, e);
  }
  const toolRows = toolEvents
    .filter((e) => e.type === "tool_started")
    .map((started) => {
      const completed = completedById.get((started as { stepId: string }).stepId);
      return { started, completed };
    });

  const modelRoute = events.find(
    (e): e is Extract<ChatStreamEvent, { type: "model_route" }> => e.type === "model_route"
  );

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-zinc-900">Status: {STATUS_LABELS[status] ?? status}</span>
        {error ? <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">{error}</span> : null}
      </div>

      {toolRows.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {toolRows.map(({ started, completed }) => (
            <li key={started.stepId} className="flex items-start gap-2">
              <span className={completed?.success ? "text-emerald-600" : completed ? "text-red-600" : "text-zinc-400"}>
                {completed ? (completed.success ? "OK" : "FAIL") : "RUN"}
              </span>
              <span className="font-mono text-[11px] text-zinc-500">{started.stepId}</span>
              <span className="text-zinc-800">{started.toolName}</span>
              {completed ? (
                <span className="ml-auto text-zinc-500">{completed.latencyMs} ms</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {modelRoute ? (
        <div className="mt-2 rounded bg-zinc-50 p-2">
          <div className="font-medium text-zinc-800">
            Modell: {modelRoute.decision.modelTier} via {modelRoute.decision.provider}
          </div>
          <div className="text-zinc-600">{modelRoute.decision.reason}</div>
          {modelRoute.decision.downgrade ? (
            <div className="mt-1 rounded bg-amber-50 p-1.5 text-amber-900">
              {modelRoute.decision.downgrade.userMessage}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
