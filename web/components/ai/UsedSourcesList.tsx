"use client";

import type { ChatStreamEvent } from "./use-chat-stream";

type ToolCompleted = Extract<ChatStreamEvent, { type: "tool_completed" }>;

export function UsedSourcesList({ events }: { events: ChatStreamEvent[] }) {
  const tools = events.filter(
    (e): e is ToolCompleted => e.type === "tool_completed" && e.success
  );
  if (tools.length === 0) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 text-xs text-zinc-700 shadow-sm">
      <div className="font-medium text-zinc-900">Verwendete Quellen</div>
      <ul className="mt-2 space-y-1">
        {tools.map((tool) => (
          <li key={tool.stepId} className="flex flex-col gap-0.5 border-b border-zinc-100 pb-1 last:border-b-0">
            <span className="font-mono text-[11px] text-zinc-500">
              {tool.toolName} · {tool.latencyMs} ms
            </span>
            <span className="text-zinc-800">{tool.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
