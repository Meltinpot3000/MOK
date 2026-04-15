export const UNTERNEHMENSINFO_TABS = [
  "kennwerte",
  "mission",
  "vision",
  "werte",
  "kultur",
  "leadership",
  "sentinel-zusammenfassung",
] as const;

export type UnternehmensinfoTab = (typeof UNTERNEHMENSINFO_TABS)[number];

export function getUnternehmensinfoSubTabLabel(tab: UnternehmensinfoTab): string {
  switch (tab) {
    case "kennwerte":
      return "Kennwerte";
    case "mission":
      return "Mission";
    case "vision":
      return "Vision";
    case "werte":
      return "Werte";
    case "kultur":
      return "Kultur";
    case "leadership":
      return "Leadership";
    case "sentinel-zusammenfassung":
      return "Sentinel✨ Zusammenfassung";
    default:
      return tab;
  }
}

/** UTC-Format — identisch auf Server (Node) und Client, vermeidet Hydration-Mismatches durch toLocaleString. */
export function formatStrategyCycleTimestampUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )} UTC`;
}

export function getUnternehmensinfoStatusMessage(success: string | undefined): {
  type: "success";
  text: string;
} | null {
  if (success === "strategy-reference-saved")
    return { type: "success", text: "Unternehmensinfo wurde gespeichert." };
  if (success === "company-kennzahlen-saved")
    return { type: "success", text: "Kennwerte wurden gespeichert." };
  return null;
}
