export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }
  return grouped;
}

export function countBy<T>(items: T[], keyFn: (item: T) => string): Array<{ key: string; count: number }> {
  const grouped = groupBy(items, keyFn);
  return Object.entries(grouped).map(([key, value]) => ({ key, count: value.length }));
}

export function rankByCount(
  rows: Array<{ key: string; count: number }>,
  tieBreakerKeyFn: (row: { key: string; count: number }) => string = (row) => row.key
): Array<{ key: string; count: number; rank: number }> {
  return [...rows]
    .sort((a, b) => b.count - a.count || tieBreakerKeyFn(a).localeCompare(tieBreakerKeyFn(b)))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function distributionByKey<T>(
  items: T[],
  keyFn: (item: T) => string
): { total: number; buckets: Array<{ label: string; count: number; share: number }> } {
  const total = items.length;
  const counts = countBy(items, keyFn).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  return {
    total,
    buckets: counts.map((row) => ({
      label: row.key,
      count: row.count,
      share: total > 0 ? row.count / total : 0,
    })),
  };
}

