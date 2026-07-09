import type { CSSProperties } from "react";

/** Farbkategorien aus Markenauftritt (tenant_branding / --brand-*). */
export type BrandColorToken = "primary" | "secondary" | "accent";

const BRAND_CSS_VAR: Record<BrandColorToken, string> = {
  primary: "--brand-primary",
  secondary: "--brand-secondary",
  accent: "--brand-accent",
};

function brandVar(token: BrandColorToken): string {
  return `var(${BRAND_CSS_VAR[token]})`;
}

export type BrandSectionTheme = {
  token: BrandColorToken;
  header: CSSProperties;
  tile: CSSProperties;
  rankBadge: CSSProperties;
  metaPill: CSSProperties;
  successPanel: CSSProperties;
};

/**
 * Top-5-Zeile wie KPI-Kachel: Verlauf in Tabellenfarbe (inline, damit Tailwind nicht fehlt).
 * @param fillPercent Anteil Header-Farbe in der Füllung (Standard 30).
 */
export function getBrandTopListTileSurface(
  token: BrandColorToken,
  hovered = false,
  fillPercent = 30
): CSSProperties {
  const c = brandVar(token);
  const strong = hovered ? fillPercent + 8 : fillPercent;
  const light = hovered ? fillPercent - 6 : fillPercent - 12;
  return {
    backgroundImage: `linear-gradient(to bottom right, color-mix(in srgb, ${c} ${strong}%, white), color-mix(in srgb, ${c} ${Math.max(light, 14)}%, white))`,
    boxShadow: hovered
      ? "0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)"
      : "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
    transition: "transform 0.2s ease-out, box-shadow 0.2s ease-out, background-image 0.2s ease-out",
  };
}

export function getBrandSectionTheme(token: BrandColorToken): BrandSectionTheme {
  const c = brandVar(token);
  return {
    token,
    header: {
      backgroundImage: `linear-gradient(90deg, ${c} 0%, color-mix(in srgb, ${c} 72%, white) 100%)`,
    },
    /** Nur für nicht-interaktive Flächen; Zeilen nutzen getBrandTopListTileSurface. */
    tile: {
      backgroundColor: `color-mix(in srgb, ${c} 12%, white)`,
      borderColor: `color-mix(in srgb, ${c} 30%, white)`,
    },
    rankBadge: {
      backgroundColor: "color-mix(in srgb, white 82%, transparent)",
      color: `color-mix(in srgb, var(--brand-secondary) 88%, #18181b)`,
    },
    metaPill: {
      backgroundColor: "color-mix(in srgb, white 72%, transparent)",
      color: "#3f3f46",
    },
    successPanel: {
      backgroundColor: `color-mix(in srgb, ${c} 14%, white)`,
    },
  };
}
