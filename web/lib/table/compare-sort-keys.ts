export type SortPrimitive = string | number | bigint | boolean | Date | null | undefined;

function isEmpty(v: SortPrimitive): boolean {
  return v === null || v === undefined;
}

/**
 * Vergleicht zwei Zellwerte fuer Tabellensortierung (nulls/undefined zuletzt).
 * Zahlen und Datumsangaben werden numerisch verglichen, sonst `localeCompare` de-DE.
 */
export function compareSortKeys(a: SortPrimitive, b: SortPrimitive): number {
  if (isEmpty(a) && isEmpty(b)) return 0;
  if (isEmpty(a)) return 1;
  if (isEmpty(b)) return -1;

  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }

  if (a instanceof Date && b instanceof Date) {
    const ta = a.getTime();
    const tb = b.getTime();
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  }

  if (typeof a === "bigint" && typeof b === "bigint") {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  const sa = String(a).trim();
  const sb = String(b).trim();
  if (sa === "" && sb === "") return 0;
  if (sa === "") return 1;
  if (sb === "") return -1;

  const na = Number(sa.replace(",", "."));
  const nb = Number(sb.replace(",", "."));
  if (
    sa !== "" &&
    sb !== "" &&
    !Number.isNaN(na) &&
    !Number.isNaN(nb) &&
    Number.isFinite(na) &&
    Number.isFinite(nb)
  ) {
    return na - nb;
  }

  return sa.localeCompare(sb, "de", { numeric: true, sensitivity: "base" });
}
