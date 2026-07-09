export function normalizeTableSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesTableTitleSearch(title: string, query: string): boolean {
  const q = normalizeTableSearchQuery(query);
  if (!q) return true;
  return title.toLowerCase().includes(q);
}

export function matchesAnyTableTitleSearch(titles: string[], query: string): boolean {
  const q = normalizeTableSearchQuery(query);
  if (!q) return true;
  return titles.some((title) => title.toLowerCase().includes(q));
}
