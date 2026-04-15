"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function initialsFrom(displayLine: string, email: string | null): string {
  const base = displayLine.trim() || email?.trim() || "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? "";
    const b = parts[parts.length - 1][0] ?? "";
    return (a + b).toUpperCase();
  }
  if (base.includes("@")) {
    return base.slice(0, 2).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

type Props = {
  userDisplayLine: string;
  userEmail: string | null;
};

export function SidebarAccountMenu({ userDisplayLine, userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const initials = initialsFrom(userDisplayLine, userEmail);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Konto-Men\u00FC oeffnen"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-white shadow-sm ring-2 ring-zinc-100 hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        {initials}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 min-w-[10.5rem] rounded-md border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <Link
            href="/profile"
            role="menuitem"
            className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
            onClick={() => setOpen(false)}
          >
            Profil
          </Link>
          <a
            href="/logout"
            role="menuitem"
            className="block px-3 py-2 text-sm text-zinc-800 hover:bg-zinc-100"
          >
            Abmelden
          </a>
        </div>
      ) : null}
    </div>
  );
}
