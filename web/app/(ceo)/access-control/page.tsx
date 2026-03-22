import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCeoAccessContext, getAuthenticatedUserId } from "@/lib/ceo/queries";
import {
  getRoleAccessMatrix,
  saveRoleAccessMatrix,
} from "@/lib/rbac/sidebar-access";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import { RoleAccessMatrixTable } from "@/components/access-control/RoleAccessMatrixTable";
import { SIDEBAR_ITEMS } from "@/lib/sidebar-access";

export default async function AccessControlPage() {
  const pageAccess = await getSidebarAccessContext("access-control");
  if (pageAccess.state === "unauthenticated") {
    redirect("/login");
  }
  if (pageAccess.state === "forbidden") {
    redirect("/no-access");
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");
  const access = await getCeoAccessContext(userId);
  if (!access) redirect("/no-access");

  const { roles, matrix } = await getRoleAccessMatrix(access.organizationId);
  const matrixMap = new Map(matrix.map((row) => [`${row.role_id}__${row.item_id}`, row.level]));
  const matrixMapRecord = Object.fromEntries(matrixMap) as Record<
    string,
    "none" | "read" | "write"
  >;
  const canWrite = pageAccess.canWrite;

  async function saveAccessMatrix(formData: FormData) {
    "use server";

    const localAccess = await getSidebarAccessContext("access-control");
    if (localAccess.state !== "ok" || !localAccess.canWrite) {
      redirect("/no-access");
    }

    const localUserId = await getAuthenticatedUserId();
    if (!localUserId) redirect("/login");
    const localContext = await getCeoAccessContext(localUserId);
    if (!localContext) redirect("/no-access");

    const local = await getRoleAccessMatrix(localContext.organizationId);
    const levels: Record<string, "none" | "read" | "write"> = {};

    for (const role of local.roles) {
      for (const item of SIDEBAR_ITEMS) {
        const key = `${role.id}__${item.id}`;
        const raw = String(formData.get(key) ?? "none");
        levels[key] = raw === "write" ? "write" : raw === "read" ? "read" : "none";
      }
    }

    await saveRoleAccessMatrix(
      localContext.organizationId,
      local.roles.map((role) => role.id),
      levels
    );

    revalidatePath("/access-control");
    redirect("/access-control");
  }

  return (
    <div className="space-y-6">
      <header className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rollenrechte</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Rollenrechte pro Sidebar-Item</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pro Rolle kannst du pro Bereich festlegen: kein Zugriff, Lesen oder Schreiben.
        </p>
      </header>

      <section className="brand-card p-6">
        <form action={saveAccessMatrix}>
          <div className="overflow-x-auto">
            <RoleAccessMatrixTable
              roles={roles}
              matrixMap={matrixMapRecord}
              canWrite={canWrite}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            {!canWrite ? (
              <p className="brand-surface p-2 text-sm text-zinc-600">
                Diese Rolle hat nur Leserechte für Rollenrechte.
              </p>
            ) : (
              <p className="text-sm text-zinc-600">
                Hinweis: Schreiben setzt automatisch Lesen.
              </p>
            )}
            <button type="submit" disabled={!canWrite} className="brand-btn px-4 py-2 text-sm">
              Rechte speichern
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
