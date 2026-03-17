"use client";

import { useState } from "react";

type LiveRangeInputProps = {
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  inputClassName?: string;
};

export function LiveRangeInput({
  name,
  defaultValue,
  min = 1,
  max = 5,
  step = 1,
  inputClassName = "min-w-0 flex-1 accent-[var(--brand-primary)]",
}: LiveRangeInputProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          setValue(Number(event.target.value));
        }}
        className={inputClassName}
      />
      <span className="w-10 shrink-0 text-right text-xs font-medium text-zinc-700">{value}/5</span>
    </div>
  );
}
