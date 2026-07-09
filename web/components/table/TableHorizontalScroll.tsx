"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type TableHorizontalScrollProps = {
  children: ReactNode;
  className?: string;
  /** Sichtbare Rahmenlinie um den Scroll-Bereich */
  bordered?: boolean;
  /** Zweite Scrollleiste oben (sticky), synchron mit dem Hauptbereich */
  stickyMirror?: boolean;
  /** Meldet die sichtbare Containerbreite (z. B. für aufgeklappte Panel-Zeilen). */
  onViewportWidthChange?: (width: number) => void;
  /** Erzwingt Neu-Messung bei Layout-Änderungen (z. B. aufgeklappte Tabellenzeilen). */
  layoutKey?: string | number;
};

export function TableHorizontalScroll({
  children,
  className,
  bordered = true,
  stickyMirror = true,
  onViewportWidthChange,
  layoutKey,
}: TableHorizontalScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const syncingScroll = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentScrollWidth, setContentScrollWidth] = useState(0);

  const updateScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nextViewport = el.clientWidth;
    const nextScroll = el.scrollWidth;
    setViewportWidth(nextViewport);
    setContentScrollWidth(nextScroll);
    onViewportWidthChange?.(nextViewport);
  }, [onViewportWidthChange]);

  useEffect(() => {
    updateScrollMetrics();
    const el = scrollRef.current;
    if (!el) return;

    const ro = new ResizeObserver(updateScrollMetrics);
    ro.observe(el);

    const mo = new MutationObserver(updateScrollMetrics);
    mo.observe(el, { childList: true, subtree: true, attributes: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [children, layoutKey, updateScrollMetrics]);

  const syncHorizontalScroll = useCallback((source: "top" | "main", scrollLeft: number) => {
    if (syncingScroll.current) return;
    syncingScroll.current = true;
    if (source === "top") {
      if (scrollRef.current) scrollRef.current.scrollLeft = scrollLeft;
    } else if (topScrollRef.current) {
      topScrollRef.current.scrollLeft = scrollLeft;
    }
    syncingScroll.current = false;
  }, []);

  const showHorizontalScroll = contentScrollWidth > viewportWidth + 1;
  const borderClass = bordered ? "border border-zinc-200" : "";

  const rootClass = ["w-full min-w-0 max-w-full", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass}>
      {stickyMirror && showHorizontalScroll ? (
        <div
          ref={topScrollRef}
          className={`sticky top-0 z-10 overflow-x-auto rounded-t border-b-0 bg-zinc-50 py-0.5 ${borderClass}`}
          style={{ height: "1.25rem" }}
          onScroll={(e) => syncHorizontalScroll("top", e.currentTarget.scrollLeft)}
          aria-label="Horizontal scrollen"
          title="Horizontal scrollen"
        >
          <div style={{ width: contentScrollWidth, height: 1 }} />
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className={`w-full min-w-0 max-w-full overflow-x-auto ${
          bordered
            ? showHorizontalScroll && stickyMirror
              ? "rounded-b border border-t-0 border-zinc-200"
              : "rounded border border-zinc-200"
            : ""
        }`}
        onScroll={(e) => {
          syncHorizontalScroll("main", e.currentTarget.scrollLeft);
          updateScrollMetrics();
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Panel in aufgeklappter Tabellenzeile: bleibt auf sichtbarer Breite, ohne mitzuscrollen. */
export function TableExpandedPanel({
  viewportWidth,
  children,
  className,
}: {
  viewportWidth: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`sticky left-0 box-border max-w-full bg-zinc-50/50 ${className ?? ""}`}
      style={{ width: viewportWidth > 0 ? viewportWidth : undefined }}
    >
      <div className="p-4">{children}</div>
    </div>
  );
}
