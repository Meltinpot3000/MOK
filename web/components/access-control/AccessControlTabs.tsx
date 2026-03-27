import Link from "next/link";

export type AccessControlTabId = "navigation" | "okr" | "rules";

type Props = {
  active: AccessControlTabId;
};

const tabs: { id: AccessControlTabId; label: string }[] = [
  { id: "navigation", label: "Navigation" },
  { id: "okr", label: "OKR-Objektrechte" },
  { id: "rules", label: "OKR-Systemregeln" },
];

export function AccessControlTabs({ active }: Props) {
  return (
    <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2" aria-label="Rollenrechte-Bereiche">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <Link
            key={t.id}
            href={t.id === "navigation" ? "/access-control" : `/access-control?tab=${t.id}`}
            className={
              isActive
                ? "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
