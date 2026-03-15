import { redirect } from "next/navigation";
import { AreaPlaceholder } from "@/components/ceo/AreaPlaceholder";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export default async function KeyFiguresPage() {
  const pageAccess = await getSidebarAccessContext("key-figures");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  return (
    <AreaPlaceholder
      title="Strategic Key Figures"
      purpose="Konsolidierte Sicht auf strategische Kennzahlen mit Baselines, Zielwerten und Abweichungen."
      audience="Executive Team, Strategy Office, Controlling"
    />
  );
}
