export type SidebarItemId =
  | "dashboard"
  | "key-figures"
  | "strategy-cycle"
  | "strategic-directions"
  | "annual-targets"
  | "initiatives"
  | "okr-workspace"
  | "reviews"
  | "organization"
  | "planning-cycles"
  | "invitations"
  | "branding"
  | "access-control"
  | "llm-usage";

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
  { id: "reviews", href: "/reviews", label: "Reviewzyklus", section: "phase1" },
  { id: "okr-workspace", href: "/okr/dashboard", label: "OKR Zyklus", section: "phase1" },
  {
    id: "strategic-directions",
    href: "/strategic-directions",
    label: "Strategische Sto\u00DFrichtungen",
    section: "phase1",
  },
  { id: "annual-targets", href: "/annual-targets", label: "Jahresziele", section: "phase1" },
  {
    id: "initiatives",
    href: "/initiatives",
    label: "Initiativen / Programme",
    section: "phase1",
  },
  { id: "organization", href: "/organization", label: "Organisationsstruktur", section: "phase0" },
  { id: "access-control", href: "/access-control", label: "Rollenrechte", section: "admin" },
  { id: "llm-usage", href: "/llm-usage", label: "Systemkonfiguration und -information", section: "admin" },
  { id: "branding", href: "/branding", label: "Markenauftritt", section: "admin" },
  { id: "invitations", href: "/invitations", label: "Benutzer", section: "admin" },
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

  if (pathname === "/strategy-matrix") {
    return "strategy-cycle";
  }

  if (pathname.startsWith("/okr")) {
    return "okr-workspace";
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

/**
 * Aktiver Sidebar-Link inkl. Unterpfaden (z. B. alle /okr/* fuer «OKR Zyklus»).
 * Ausnahme: «Dashboard» nur exakt /dashboard — Zyklen nutzen den eigenen Eintrag unter «Zyklen».
 */
export function isSidebarNavItemActive(pathname: string, item: SidebarItem): boolean {
  if (item.id === "dashboard") {
    return pathname === "/dashboard";
  }

  if (item.id === "strategy-cycle") {
    return (
      pathname === item.href ||
      pathname === "/strategy-matrix" ||
      pathname.startsWith(`${item.href}/`)
    );
  }

  if (item.id === "okr-workspace") {
    return pathname === "/okr" || pathname.startsWith("/okr/");
  }

  if (item.id === "organization") {
    return (
      pathname === "/organization" ||
      pathname.startsWith("/organization/") ||
      pathname === "/responsibles" ||
      pathname === "/industries" ||
      pathname === "/business-models" ||
      pathname === "/operating-models"
    );
  }

  if (item.id === "planning-cycles") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
