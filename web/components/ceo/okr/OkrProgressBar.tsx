type OkrProgressBarProps = {
  /** 0–100 */
  value: number;
  className?: string;
};

/** Thin progress bar; OKR-Objective rollup uses MVP average of KR progress (not governance). */
export function OkrProgressBar({ value, className = "" }: OkrProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-zinc-200 ${className}`}>
      <div
        className="h-full rounded-full bg-zinc-700 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
