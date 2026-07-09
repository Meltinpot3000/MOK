export type SidebarItemId =
  | "dashboard"
  | "key-figures"
  | "strategy-cycle"
  | "strategic-directions"
  | "annual-targets"
  | "initiatives"
  | "okr-workspace"
  | "reviews"
  | "my-tasks"
  | "ai-assistant"
  | "organization"
  | "strategy-network"
  | "planning-cycles"
  | "invitations"
  | "directory-sync"
  | "branding"
  | "access-control"
  | "llm-usage";

export type SidebarSection = "top" | "phase1" | "phase0" | "cycles" | "admin";

export type PipNavItemId = "programs" | "pip-initiatives";

export type PipNavItem = {
  id: PipNavItemId;
  href: string;
  label: string;
};

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
  { id: "my-tasks", href: "/my-tasks", label: "Meine Aufgaben", section: "top" },
  { id: "ai-assistant", href: "/ai-assistant", label: "Sentinel Assistant", section: "top" },
  { id: "key-figures", href: "/key-figures", label: "Kennzahlen", section: "phase1" },
  { id: "strategy-cycle", href: "/strategy-cycle", label: "Strategiezyklus", section: "phase1" },
  { id: "reviews", href: "/reviews", label: "Reviewzyklus", section: "phase1" },
  { id: "annual-targets", href: "/annual-targets", label: "Jahresziele", section: "phase1" },
  { id: "okr-workspace", href: "/okr/dashboard", label: "OKR-Zyklus", section: "phase1" },
  {
    id: "strategic-directions",
    href: "/strategic-directions",
    label: "Strategische Sto\u00DFrichtungen",
    section: "phase1",
  },
  {
    id: "initiatives",
    href: "/initiatives",
    label: "Initiativen / Programme",
    section: "phase1",
  },
  { id: "organization", href: "/organization", label: "Organisationsstruktur", section: "phase0" },
  {
    id: "strategy-network",
    href: "/strategienetzwerk",
    label: "Strategienetzwerk",
    section: "phase1",
  },
  { id: "access-control", href: "/access-control", label: "Rollenrechte", section: "admin" },
  { id: "llm-usage", href: "/llm-usage", label: "Systemkonfiguration und -information", section: "admin" },
  { id: "branding", href: "/branding", label: "Markenauftritt", section: "admin" },
  { id: "invitations", href: "/invitations", label: "Benutzer", section: "admin" },
  {
    id: "directory-sync",
    href: "/directory-sync",
    label: "Entra ID (optional)",
    section: "admin",
  },
  { id: "planning-cycles", href: "/planning-cycles", label: "Neuer Planungszyklus", section: "cycles" },
];

export const SIDEBAR_ITEM_IDS = SIDEBAR_ITEMS.map((item) => item.id);

/** Programme & Initiativen (Strategiezyklus PIPs) — Rechte wie Strategiezyklus. */
export const PIPS_NAV_ITEMS: readonly PipNavItem[] = [
  {
    id: "programs",
    href: "/strategy-cycle?l1=pips&l2=programme",
    label: "Programme",
  },
  {
    id: "pip-initiatives",
    href: "/strategy-cycle?l1=pips&l2=initiativen",
    label: "Initiativen",
  },
] as const;

const STRATEGIC_PLANNING_NAV_IDS: SidebarItemId[] = [
  "dashboard",
  "strategy-cycle",
  "reviews",
  "strategy-network",
];

const ANNUAL_PLANNING_NAV_IDS: SidebarItemId[] = ["annual-targets", "okr-workspace"];

function canReadAnnualTargetsNav(permissions: SidebarPermissionMap): boolean {
  return Boolean(
    permissions["annual-targets"]?.read || permissions["strategy-cycle"]?.read
  );
}

export function parseStrategyCycleNavQuery(searchParams: URLSearchParams): {
  l1: string | null;
  l2: string | null;
} {
  return {
    l1: searchParams.get("l1"),
    l2: searchParams.get("l2"),
  };
}

/** Oberer Nav-Block (z. B. «Meine Aufgaben»), vor «Strategische Planung». */
export function getVisibleTopNavItems(permissions: SidebarPermissionMap): SidebarItem[] {
  return SIDEBAR_ITEMS.filter(
    (item) => item.section === "top" && Boolean(permissions[item.id]?.read)
  );
}

/** @deprecated Nutze getVisibleStrategicPlanningNavItems / Annual / Pips. */
export function getVisiblePhase1NavItems(permissions: SidebarPermissionMap): SidebarItem[] {
  return getVisibleStrategicPlanningNavItems(permissions);
}

export function getVisibleStrategicPlanningNavItems(
  permissions: SidebarPermissionMap
): SidebarItem[] {
  return SIDEBAR_ITEMS.filter((item) => {
    if (!STRATEGIC_PLANNING_NAV_IDS.includes(item.id)) return false;
    if (item.id === "strategy-network") {
      return Boolean(permissions["strategy-network"]?.read);
    }
    return Boolean(permissions[item.id]?.read);
  });
}

export function getVisibleAnnualPlanningNavItems(
  permissions: SidebarPermissionMap
): SidebarItem[] {
  return ANNUAL_PLANNING_NAV_IDS.flatMap((id) => {
    const item = SIDEBAR_ITEMS.find((i) => i.id === id);
    if (!item) return [];
    if (id === "annual-targets") {
      return canReadAnnualTargetsNav(permissions) ? [item] : [];
    }
    return permissions[id]?.read ? [item] : [];
  });
}

export function getVisiblePipsNavItems(permissions: SidebarPermissionMap): PipNavItem[] {
  if (!permissions["strategy-cycle"]?.read) {
    return [];
  }
  return [...PIPS_NAV_ITEMS];
}

export function getVisiblePhase0NavItems(permissions: SidebarPermissionMap): SidebarItem[] {
  return SIDEBAR_ITEMS.filter(
    (item) =>
      item.section === "phase0" &&
      Boolean(permissions[item.id]?.read) &&
      item.id !== "strategy-network"
  );
}

export function getVisibleCyclesNavItems(permissions: SidebarPermissionMap): SidebarItem[] {
  return SIDEBAR_ITEMS.filter((item) => item.section === "cycles" && Boolean(permissions[item.id]?.read));
}

export function getVisibleAdminNavItems(permissions: SidebarPermissionMap): SidebarItem[] {
  return SIDEBAR_ITEMS.filter((item) => item.section === "admin" && Boolean(permissions[item.id]?.read));
}

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

  if (pathname === "/strategy-matrix" || pathname.startsWith("/strategy-matrix/")) {
    return "annual-targets";
  }

  if (pathname === "/annual-targets" || pathname.startsWith("/annual-targets/")) {
    return "annual-targets";
  }

  if (pathname.startsWith("/okr")) {
    return "okr-workspace";
  }

  if (pathname === "/my-tasks" || pathname.startsWith("/my-tasks/")) {
    return "my-tasks";
  }

  if (pathname === "/ai-assistant" || pathname.startsWith("/ai-assistant/")) {
    return "ai-assistant";
  }

  if (
    pathname === "/responsibles" ||
    pathname === "/industries" ||
    pathname === "/business-models" ||
    pathname === "/operating-models"
  ) {
    return "organization";
  }

  if (pathname === "/strategienetzwerk" || pathname.startsWith("/strategienetzwerk/")) {
    return "strategy-network";
  }

  return null;
}

/**
 * Aktiver Sidebar-Link inkl. Unterpfaden (z. B. alle /okr/* fuer «OKR Zyklus»).
 * Ausnahme: «Dashboard» nur exakt /dashboard — Zyklen nutzen den eigenen Eintrag unter «Zyklen».
 */
export function isPipNavItemActive(
  pathname: string,
  searchParams: URLSearchParams,
  item: PipNavItem
): boolean {
  if (pathname !== "/strategy-cycle" && !pathname.startsWith("/strategy-cycle/")) {
    return false;
  }
  const { l1, l2 } = parseStrategyCycleNavQuery(searchParams);
  if (item.id === "programs") {
    return l1 === "pips" && l2 === "programme";
  }
  return l1 === "pips" && l2 === "initiativen";
}

export function isSidebarNavItemActive(
  pathname: string,
  item: SidebarItem,
  searchParams?: URLSearchParams | null
): boolean {
  if (item.id === "dashboard") {
    return pathname === "/dashboard";
  }

  if (item.id === "annual-targets") {
    if (
      pathname === "/annual-targets" ||
      pathname.startsWith("/annual-targets/") ||
      pathname === "/strategy-matrix" ||
      pathname.startsWith("/strategy-matrix/")
    ) {
      return true;
    }
    if (searchParams && (pathname === "/strategy-cycle" || pathname.startsWith("/strategy-cycle/"))) {
      const { l1, l2 } = parseStrategyCycleNavQuery(searchParams);
      return l1 === "corporate-strategy" && l2 === "strategy-matrix";
    }
    return false;
  }

  if (item.id === "strategy-cycle") {
    if (pathname === "/unternehmensinfo" || pathname.startsWith("/unternehmensinfo/")) {
      return false;
    }
    if (pathname === "/strategy-matrix" || pathname.startsWith("/strategy-matrix/")) {
      return false;
    }
    if (pathname === "/strategy-cycle" || pathname.startsWith("/strategy-cycle/")) {
      if (searchParams) {
        const { l1, l2 } = parseStrategyCycleNavQuery(searchParams);
        if (l1 === "pips") return false;
        if (l1 === "corporate-strategy" && l2 === "strategy-matrix") return false;
      }
      return true;
    }
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  if (item.id === "okr-workspace") {
    return pathname === "/okr" || pathname.startsWith("/okr/");
  }

  if (item.id === "my-tasks") {
    return pathname === "/my-tasks" || pathname.startsWith("/my-tasks/");
  }

  if (item.id === "ai-assistant") {
    return pathname === "/ai-assistant" || pathname.startsWith("/ai-assistant/");
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

  if (item.id === "strategy-network") {
    return pathname === "/strategienetzwerk" || pathname.startsWith("/strategienetzwerk/");
  }

  if (item.id === "planning-cycles") {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
