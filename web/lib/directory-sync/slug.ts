export function slugifyAttributePath(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function entraUnitCode(attributeValue: string): string {
  const slug = slugifyAttributePath(attributeValue);
  return `entra-dept-${slug || "unknown"}`;
}

export function hashExternalKey(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h << 5) - h + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/** Stable external id for attribute-derived org units (not Entra object ids). */
export function entraAttributeExternalId(attributeValue: string): string {
  return `attr:${hashExternalKey(attributeValue.trim().toLowerCase())}`;
}

export function splitAttributePath(value: string, separator: string | null): string[] {
  if (!separator || separator.length === 0) {
    return [value.trim()];
  }
  return value
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
