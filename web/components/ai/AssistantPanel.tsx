"use client";

import { useMemo } from "react";

import { MessageInput } from "./MessageInput";
import { RunStatusStream } from "./RunStatusStream";
import { UsedSourcesList } from "./UsedSourcesList";
import { useChatStream } from "./use-chat-stream";

export type AssistantPanelProps = {
  organizationName: string;
  permissionCodes: string[];
};

export function AssistantPanel({ organizationName, permissionCodes }: AssistantPanelProps) {
  const { state, send } = useChatStream();

  const permissionLabel = useMemo(() => {
    const total = permissionCodes.length;
    const navCount = permissionCodes.filter((c) => c.startsWith("nav.")).length;
    return `${total} Capabilities (davon ${navCount} nav.*)`;
  }, [permissionCodes]);

  async function handleSubmit(text: string) {
    await send({
      question: text,
      conversationId: state.conversationId,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="md:col-span-2 space-y-3">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
          Organisation: <span className="font-medium">{organizationName}</span> · {permissionLabel}
        </div>

        <div className="space-y-3">
          {state.messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "rounded-md border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900"
                  : "rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-900 shadow-sm"
              }
            >
              <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                {m.role === "user" ? "Du" : "Sentinel"}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          {state.busy ? (
            <div className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500">
              Sentinel arbeitet...
            </div>
          ) : null}
        </div>

        <MessageInput onSubmit={handleSubmit} busy={state.busy} />
      </div>
      <aside className="space-y-3">
        <RunStatusStream status={state.status} events={state.events} error={state.error} />
        <UsedSourcesList events={state.events} />
      </aside>
    </div>
  );
}
