import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { UI_INVENTORY_MAX_ROUTES } from "./caps";
import type { UiRouteInventoryEntry } from "./inventory-types";

const PAGE_FILE = "page.tsx";

function extractExportConstMetadataTitle(source: string): string | null {
  const m = source.match(/export\s+const\s+metadata\s*=\s*\{[\s\S]*?title\s*:\s*["']([^"']+)["']/);
  return m?.[1] ?? null;
}

function routeFromAppRelativePath(appRelativeDir: string): string {
  const segments = appRelativeDir.split(/[/\\]/).filter(Boolean);
  const parts: string[] = [];
  for (const s of segments) {
    if (s.startsWith("(") && s.endsWith(")")) continue;
    if (s.startsWith("@")) continue;
    parts.push(s);
  }
  const p = parts.join("/");
  return p ? `/${p}` : "/";
}

/**
 * Heuristik: `web/app` relativ zu `webRoot` (Default: cwd, z. B. bei `npm --prefix web`).
 */
export function collectUiInventory(
  webRoot: string = process.cwd(),
  options?: {
    maxRoutes?: number;
    pathFilter?: (path: string) => boolean;
  }
): UiRouteInventoryEntry[] {
  const appDir = join(webRoot, "app");
  const out: UiRouteInventoryEntry[] = [];
  let remaining = options?.maxRoutes ?? UI_INVENTORY_MAX_ROUTES;
  const pathFilter = options?.pathFilter;

  function visitDir(dir: string) {
    if (remaining <= 0 || !existsSync(dir)) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (remaining <= 0) return;
      if (name === "node_modules" || name.startsWith(".")) continue;
      const full = join(dir, name);
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(full, { throwIfNoEntry: false });
      } catch {
        continue;
      }
      if (!st?.isDirectory()) continue;
      const pagePath = join(full, PAGE_FILE);
      if (existsSync(pagePath)) {
        try {
          const raw = readFileSync(pagePath, "utf8");
          const rel = full.slice(appDir.length).replace(/\\/g, "/").replace(/^\//, "");
          const path = routeFromAppRelativePath(rel);
          if (pathFilter && !pathFilter(path)) continue;
          out.push({
            path,
            label: extractExportConstMetadataTitle(raw),
          });
          remaining -= 1;
        } catch {
          /* skip */
        }
      }
      visitDir(full);
    }
  }

  visitDir(appDir);
  return out;
}
