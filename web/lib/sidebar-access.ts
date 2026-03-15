export type SidebarItemId =
  | "dashboard"
  | "key-figures"
  | "strategy-cycle"
  | "strategic-directions"
  | "annual-targets"
  | "initiatives"
  | "okr-workspace"
  | "reviews"
  | "strategy-matrix"
  | "organization"
  | "planning-cycles"
  | "invitations"
  | "branding"
  | "access-control";

export type SidebarSection = "phase1" | "phase0" | "cycles" | "admin";

export type SidebarItem = {
  id: SidebarItemId;
  href: string;
  label: string;
  section: SidebarSection;
};

export type SidebarItemPermission = {
  read: boolean;
  write: boolean;
};

export type SidebarPermissionMap = Record<SidebarItemId, SidebarItemPermission>;

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", section: "phase1" },
  { id: "key-figures", href: "/key-figures", label: "Kennzahlen", section: "phase1" },
  { id: "strategy-cycle", href: "/strategy-cycle", label: "Strategiezyklus", section: "phase1" },
  {
    id: "strategic-directions",
    href: "/strategic-directions",
    label: "Strategische Stossrichtungen",
    section: "phase1",
  },
  { id: "annual-targets", href: "/annual-targets", label: "Jahresziele", section: "phase1" },
  {
    id: "initiatives",
    href: "/initiatives",
    label: "Initiativen / Programme",
    section: "phase1",
  },
  { id: "okr-workspace", href: "/okr-workspace", label: "OKR-Arbeitsbereich", section: "phase1" },
  { id: "reviews", href: "/reviews", label: "Review & Retrospektive", section: "phase1" },
  { id: "strategy-matrix", href: "/strategy-matrix", label: "Strategie-Matrix", section: "phase1" },
  { id: "organization", href: "/organization", label: "Aufbauorganisation", section: "phase0" },
  { id: "access-control", href: "/access-control", label: "Rollenrechte", section: "admin" },
  { id: "branding", href: "/branding", label: "Branding", section: "admin" },
  { id: "invitations", href: "/invitations", label: "Einladungen", section: "admin" },
  { id: "planning-cycles", href: "/planning-cycles", label: "Neuer Planungszyklus", section: "cycles" },
];

export const SIDEBAR_ITEM_IDS = SIDEBAR_ITEMS.map((item) => item.id);

export function getReadPermissionCode(itemId: SidebarItemId): string {
  return `nav.${itemId}.read`;
}

export function getWritePermissionCode(itemId: SidebarItemId): string {
  return `nav.${itemId}.write`;
}

export function getEmptySidebarPermissionMap(): SidebarPermissionMap {
  return SIDEBAR_ITEM_IDS.reduce(
    (acc, itemId) => {
      acc[itemId] = { read: false, write: false };
      return acc;
    },
    {} as SidebarPermissionMap
  );
}

export function getItemIdForPath(pathname: string): SidebarItemId | null {
  const exact = SIDEBAR_ITEMS.find((item) => item.href === pathname);
  if (exact) {
    return exact.id;
  }

  if (pathname.startsWith("/dashboard/cycles/")) {
    return "dashboard";
  }

  if (
    pathname === "/responsibles" ||
    pathname === "/industries" ||
    pathname === "/business-models" ||
    pathname === "/operating-models"
  ) {
    return "organization";
  }

  return null;
}
