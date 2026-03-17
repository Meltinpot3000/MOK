import { redirect } from "next/navigation";
import { AreaPlaceholder } from "@/components/ceo/AreaPlaceholder";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export default async function OkrWorkspacePage() {
  const pageAccess = await getSidebarAccessContext("okr-workspace");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  return (
    <AreaPlaceholder
      eyebrow="OKR Zyklus"
      title="OKR Arbeitsbereich"
      purpose="Einfache Arbeitsoberflaeche fuer Teams zur operativen Umsetzung ueber 3-Monats-Zyklen, Check-ins und Zuversicht."
      audience="Teams, Teamleitungen, OKR-Verantwortliche"
    />
  );
}
