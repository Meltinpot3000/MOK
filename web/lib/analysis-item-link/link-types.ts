export const LINK_TYPE_OPTIONS = [
  { value: "related_to", label: "verwandt mit" },
  { value: "causes", label: "verursacht" },
  { value: "supports", label: "unterstützt" },
  { value: "contradicts", label: "widerspricht" },
  { value: "amplifies", label: "verstärkt" },
  { value: "depends_on", label: "abhängig von" },
  { value: "duplicates", label: "dupliziert" },
] as const;

export function getLinkTypeLabel(value: string): string {
  const opt = LINK_TYPE_OPTIONS.find((o) => o.value === value);
  return opt?.label ?? value;
}
