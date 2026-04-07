import { redirect } from "next/navigation";
import { DashboardAreaNav } from "@/components/ceo/DashboardAreaNav";
import { getAuthenticatedUserId, getPlanningCyclesForOrganization } from "@/lib/ceo/queries";
import { getAppShellAccess } from "@/lib/rbac/page-access";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  const shell = await getAppShellAccess(userId);
  if (!shell) {
    redirect("/no-access");
  }

  if (!shell.permissions.dashboard.read) {
    return children;
  }

  const cycles = await getPlanningCyclesForOrganization(shell.access.organizationId);

  return (
    <div className="space-y-4">
      <div className="brand-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Strategie-Dashboard</p>
        <DashboardAreaNav cycles={cycles} />
      </div>
      {children}
    </div>
  );
}
