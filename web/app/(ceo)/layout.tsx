import { redirect } from "next/navigation";
import { CycleSidebar } from "@/components/ceo/CycleSidebar";
import {
  getAuthenticatedUserId,
  getCeoAccessContext,
  getPlanningCyclesForOrganization,
} from "@/lib/ceo/queries";

export default async function CeoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const access = await getCeoAccessContext(userId);

  if (!access) {
    redirect("/no-access");
  }

  const cycles = await getPlanningCyclesForOrganization(access.organizationId);

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <CycleSidebar cycles={cycles} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
