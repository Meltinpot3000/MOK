"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { markMemberNotificationsReadAction } from "@/lib/tasks/completion-review-actions";

type NotificationRow = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  key_result_id: string | null;
  created_at: string;
  read_at: string | null;
};

const POLL_INTERVAL_MS = 20_000;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  return `vor ${diffH} Std.`;
}

export function MemberNotificationsBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (signal: AbortSignal) => {
    try {
      const res = await fetch("/api/member-notifications", { signal });
      if (!res.ok) return;
      const { notifications } = (await res.json()) as { notifications: NotificationRow[] };
      setItems(notifications ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchNotifications(controller.signal);
    const id = setInterval(() => void fetchNotifications(controller.signal), POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [open]);

  const unread = items.filter((n) => !n.read_at);
  const unreadCount = unread.length;

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open && unread.length > 0) {
      startTransition(async () => {
        await markMemberNotificationsReadAction(unread.map((n) => n.id));
        setItems((prev) =>
          prev.map((n) =>
            unread.some((u) => u.id === n.id)
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
      });
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        disabled={pending}
        className="relative rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-60"
        aria-label={unreadCount > 0 ? `${unreadCount} Benachrichtigungen` : "Benachrichtigungen"}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white"
            aria-hidden
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">Keine Benachrichtigungen</div>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Benachrichtigungen
                </p>
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className="border-b border-zinc-50 px-4 py-2.5 last:border-0">
                    <p className="text-sm font-medium text-zinc-900">{n.title}</p>
                    <p className="mt-0.5 text-xs leading-snug text-zinc-600">{n.body}</p>
                    <p className="mt-1 text-[10px] text-zinc-400">{formatRelativeTime(n.created_at)}</p>
                    {n.key_result_id ? (
                      <Link
                        href="/okr/tracking"
                        className="mt-1 inline-block text-[11px] font-medium text-indigo-700 hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        Zum OKR-Tracking →
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
