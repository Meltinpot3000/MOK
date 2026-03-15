import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCeoAccessContext, getAuthenticatedUserId } from "@/lib/ceo/queries";
import {
  getRoleAccessMatrix,
  saveRoleAccessMatrix,
} from "@/lib/rbac/sidebar-access";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
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
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Adminbereich</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Rollenrechte pro Sidebar-Item</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pro Rolle kannst du pro Bereich festlegen: kein Zugriff, Lesen oder Schreiben.
        </p>
      </header>

      <section className="brand-card p-6">
        <form action={saveAccessMatrix}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2 pr-3">Sidebar-Item</th>
                  {roles.map((role) => (
                    <th key={role.id} className="py-2 pr-3">
                      <div className="font-semibold text-zinc-700">{role.name}</div>
                      <div className="text-xs text-zinc-500">{role.code}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SIDEBAR_ITEMS.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 align-top">
                    <td className="py-3 pr-3">
                      <div className="font-medium text-zinc-900">{item.label}</div>
                      <div className="text-xs text-zinc-500">{item.href}</div>
                    </td>
                    {roles.map((role) => {
                      const key = `${role.id}__${item.id}`;
                      const level = matrixMap.get(key) ?? "none";

                      return (
                        <td key={key} className="py-3 pr-3">
                          <select
                            name={key}
                            defaultValue={level}
                            disabled={!canWrite}
                            className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-xs"
                          >
                            <option value="none">Kein Zugriff</option>
                            <option value="read">Lesen</option>
                            <option value="write">Schreiben</option>
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
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
