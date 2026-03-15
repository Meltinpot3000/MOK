import { redirect } from "next/navigation";
import { AreaPlaceholder } from "@/components/ceo/AreaPlaceholder";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export default async function ReviewsPage() {
  const pageAccess = await getSidebarAccessContext("reviews");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  return (
    <AreaPlaceholder
      title="Review & Retrospective"
      purpose="Strukturierte Reviews, Retrospektiven und Improvements zur iterativen Anpassung der nächsten Zyklen."
      audience="Management, Strategy Owner, Teams"
    />
  );
}
