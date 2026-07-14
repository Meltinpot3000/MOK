export type CompanyKennzahlen = {
  organizationsform: string;
  organizationsform_other: string;
  unternehmensgroesse: string;
  industriekontext: string;
  industriekontext_other: string;
  kern_wertschoepfung: string;
  wichtigstes_produkt_oder_dienstleistung: string;
  marktregionen: string[];
  umsatz_heute: string;
  umsatz_ziel: string;
  transformation_status: string;
};

const KERN_WERTSCHOEPFUNG_OPTIONS = ["Manufacturing", "Engineering", "Services", "Hybrid"] as const;
const TRANSFORMATION_STATUS_OPTIONS = ["stabil", "in Veränderung", "unter Druck"] as const;

const ORGFORM_OPTIONS = [
  "AG",
  "GmbH",
  "Genossenschaft",
  "Stiftung",
  "Einzelunternehmen",
  "Personengesellschaft (OHG, KG)",
  "Unternehmensgruppe",
  "Holding",
  "Konzern",
  "Verein",
  "other",
] as const;

const UNTERNEHMENSGROESSE_OPTIONS = [
  "1–10",
  "11–50",
  "51–250",
  "251–500",
  "501–1000",
  "1001–5000",
  "5001+",
] as const;

const INDUSTRIE_OPTIONS = [
  "Technologie / IT",
  "Finanzdienstleistungen",
  "Gesundheitswesen",
  "Industrie / Fertigung",
  "Handel",
  "Energie / Versorgung",
  "Bau",
  "Bildung",
  "Beratung / Dienstleistung",
  "Medien / Kommunikation",
  "other",
] as const;

const MARKTREGIONEN_OPTIONS = [
  "Schweiz",
  "DACH",
  "Europa",
  "Nordamerika",
  "Südamerika",
  "Asien",
  "Naher Osten",
  "Afrika",
  "Ozeanien",
] as const;

export {
  ORGFORM_OPTIONS,
  UNTERNEHMENSGROESSE_OPTIONS,
  INDUSTRIE_OPTIONS,
  MARKTREGIONEN_OPTIONS,
  KERN_WERTSCHOEPFUNG_OPTIONS,
  TRANSFORMATION_STATUS_OPTIONS,
};

function normalizeStr(value: unknown, maxLen: number): string {
  const s = String(value ?? "").trim();
  return s.slice(0, maxLen);
}

export function readCompanyKennzahlenFromBrandingConfig(brandingConfig: unknown): CompanyKennzahlen {
  if (!brandingConfig || typeof brandingConfig !== "object") {
    return {
      organizationsform: "",
      organizationsform_other: "",
      unternehmensgroesse: "",
      industriekontext: "",
      industriekontext_other: "",
      kern_wertschoepfung: "",
      wichtigstes_produkt_oder_dienstleistung: "",
      marktregionen: [],
      umsatz_heute: "",
      umsatz_ziel: "",
      transformation_status: "",
    };
  }
  const root = brandingConfig as Record<string, unknown>;
  const regionen = root.company_info_marktregionen;
  const regionenArr = Array.isArray(regionen) ? regionen : typeof regionen === "string" ? (regionen ? [regionen] : []) : [];
  const kernWert =
    root.company_info_kern_wertschoepfung ??
    root["company_info_kern_wertsch\u00F6pfung"] ??
    (root.company_info_produkt_oder_service === "service"
      ? "Services"
      : root.company_info_produkt_oder_service === "produkt"
        ? "Manufacturing"
        : "");
  return {
    organizationsform: normalizeStr(root.company_info_organizationsform, 80),
    organizationsform_other: normalizeStr(root.company_info_organizationsform_other, 200),
    unternehmensgroesse: normalizeStr(
      root.company_info_unternehmensgroesse ?? root["company_info_unternehmensgr\u00F6\u00DFe"],
      50
    ),
    industriekontext: normalizeStr(root.company_info_industriekontext, 80),
    industriekontext_other: normalizeStr(root.company_info_industriekontext_other, 200),
    kern_wertschoepfung: normalizeStr(kernWert, 50),
    wichtigstes_produkt_oder_dienstleistung: normalizeStr(root.company_info_wichtigstes_produkt_oder_dienstleistung, 500),
    marktregionen: regionenArr.map((r) => String(r).trim()).filter(Boolean).slice(0, 20),
    umsatz_heute: normalizeStr(root.company_info_umsatz_heute, 100),
    umsatz_ziel: normalizeStr(root.company_info_umsatz_ziel, 100),
    transformation_status: normalizeStr(root.company_info_transformation_status, 50),
  };
}
