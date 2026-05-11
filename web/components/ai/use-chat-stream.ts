"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "status"; status: string; message?: string }
  | { type: "plan"; plan: unknown; usedFallback: boolean; fallbackReason?: string }
  | { type: "executable_plan"; stepCount: number; droppedCount: number; warningCount: number }
  | { type: "tool_started"; stepId: string; toolName: string; stage: number }
  | {
      type: "tool_completed";
      stepId: string;
      toolName: string;
      success: boolean;
      latencyMs: number;
      summary: string;
    }
  | {
      type: "model_route";
      decision: {
        modelTier: string;
        provider: string;
        reason: string;
        downgrade?: { from: string; to: string; userMessage: string };
      };
    }
  | { type: "answer_chunk"; delta: string }
  | { type: "answer"; text: string; provider: string; model: string; modelTier: string }
  | { type: "blocked"; reason: string; reasonCode: string }
  | { type: "error"; message: string }
  | { type: "done"; runId: string; latencyMs: number };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type SendMessageArgs = {
  question: string;
  conversationId?: string | null;
  uiContext?: Record<string, unknown> | null;
  domainHints?: string[];
};

export type UseChatStreamState = {
  events: ChatStreamEvent[];
  answer: string;
  status: string;
  error: string | null;
  busy: boolean;
  conversationId: string | null;
  messages: ChatMessage[];
};

export function useChatStream() {
  const [state, setState] = useState<UseChatStreamState>({
    events: [],
    answer: "",
    status: "idle",
    error: null,
    busy: false,
    conversationId: null,
    messages: [],
  });
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  const reset = useCallback(() => {
    setState({
      events: [],
      answer: "",
      status: "idle",
      error: null,
      busy: false,
      conversationId: null,
      messages: [],
    });
  }, []);

  const send = useCallback(async (args: SendMessageArgs): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const recentSnapshot = messagesRef.current.slice(-5).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setState((prev) => ({
      ...prev,
      messages: [
        ...prev.messages,
        { id: `user-${Date.now()}`, role: "user", content: args.question },
      ],
      events: [],
      answer: "",
      status: "sending",
      error: null,
      busy: true,
    }));

    let response: Response;
    try {
      response = await fetch("/api/ai/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: args.question,
          conversationId: args.conversationId ?? null,
          uiContext: args.uiContext ?? null,
          recentMessages: recentSnapshot,
          domainHints: args.domainHints ?? [],
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((s) => ({ ...s, status: "error", error: message, busy: false }));
      return;
    }
    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => "");
      setState((s) => ({ ...s, status: "error", error: text || `HTTP ${response.status}`, busy: false }));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf("\n\n");
        const dataLine = rawEvent
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const json = dataLine.slice(6);
        try {
          const event = JSON.parse(json) as ChatStreamEvent;
          setState((s) => {
            const next: UseChatStreamState = {
              ...s,
              events: [...s.events, event],
              status: event.type === "status" ? event.status : s.status,
            };
            if (event.type === "conversation") {
              next.conversationId = event.conversationId;
            }
            if (event.type === "answer") {
              next.answer = event.text;
              next.busy = false;
              next.status = "completed";
              next.messages = [
                ...s.messages,
                { id: `assistant-${Date.now()}`, role: "assistant", content: event.text },
              ];
            } else if (event.type === "blocked") {
              next.busy = false;
              next.status = "blocked";
              next.error = event.reason;
            } else if (event.type === "error") {
              next.error = event.message;
              next.status = "error";
            } else if (event.type === "done") {
              next.busy = false;
              if (next.status === "sending" || next.status === "synthesizing") {
                next.status = "completed";
              }
            }
            return next;
          });
        } catch {
          /* ignore malformed line */
        }
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, busy: false, status: "cancelled" }));
  }, []);

  return { state, send, cancel, reset };
}
