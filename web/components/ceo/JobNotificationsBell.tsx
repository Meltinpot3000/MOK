"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getJobTypeLabel } from "@/lib/analysis-background-jobs/labels";

type RecentJob = {
  id: string;
  job_type: string;
  finished_at: string;
  cycle_instance_id: string;
};

const POLL_INTERVAL_MS = 15_000;

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffMin < 1) return diffSec <= 0 ? "gerade eben" : `vor ${diffSec} Sek.`;
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  return `vor ${diffH} Std.`;
}

export function JobNotificationsBell() {
  const router = useRouter();
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis-background-jobs/recent");
      if (!res.ok) return;
      const { jobs: data } = (await res.json()) as { jobs: RecentJob[] };
      setJobs(data ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const id = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchJobs]);

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

  const unreadJobs = jobs.filter((j) => !seenIds.has(j.id));
  const unreadCount = unreadJobs.length;

  const handleOpen = () => {
    setOpen((o) => !o);
    if (unreadCount > 0) {
      setSeenIds((prev) => new Set([...prev, ...unreadJobs.map((j) => j.id)]));
    }
  };

  const handleRefresh = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        aria-label={unreadCount > 0 ? `${unreadCount} abgeschlossene Jobs` : "Benachrichtigungen"}
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
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {jobs.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              Keine kürzlich abgeschlossenen Jobs
            </div>
          ) : (
            <>
              <div className="border-b border-zinc-100 px-4 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Abgeschlossene Jobs
                </p>
              </div>
              <ul className="max-h-64 overflow-y-auto">
                {jobs.map((job) => (
                  <li key={job.id} className="border-b border-zinc-50 last:border-0">
                    <div className="flex flex-col gap-0.5 px-4 py-2">
                      <span className="text-sm font-medium text-zinc-900">
                        {getJobTypeLabel(job.job_type)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {formatRelativeTime(job.finished_at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-zinc-100 px-2 py-2">
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="w-full rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  Seite aktualisieren
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
