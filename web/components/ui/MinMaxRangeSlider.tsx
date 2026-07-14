"use client";

type MinMaxRangeSliderProps = {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  step?: number;
  onChange: (next: { min: number; max: number }) => void;
  className?: string;
};

const RANGE_INPUT_CLASS =
  "pointer-events-none absolute inset-x-0 top-1/2 z-20 w-full -translate-y-1/2 appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-zinc-900 " +
  "[&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-track]:bg-transparent " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
  "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 " +
  "[&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-zinc-900 [&::-moz-range-thumb]:shadow-sm";

export function MinMaxRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step = 1,
  onChange,
  className = "",
}: MinMaxRangeSliderProps) {
  const span = Math.max(1, max - min);
  const minPercent = ((valueMin - min) / span) * 100;
  const maxPercent = ((valueMax - min) / span) * 100;

  return (
    <div className={`relative h-8 ${className}`}>
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-200" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-800"
        style={{ left: `${minPercent}%`, width: `${Math.max(0, maxPercent - minPercent)}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={(event) => {
          const nextMin = Number(event.target.value);
          onChange({ min: Math.min(nextMin, valueMax), max: valueMax });
        }}
        className={`${RANGE_INPUT_CLASS} z-20`}
        aria-label="Minimum"
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={(event) => {
          const nextMax = Number(event.target.value);
          onChange({ min: valueMin, max: Math.max(nextMax, valueMin) });
        }}
        className={`${RANGE_INPUT_CLASS} z-30`}
        aria-label="Maximum"
      />
    </div>
  );
}
