import Link from "next/link";
import { redirect } from "next/navigation";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  approvalRoutingLabelDe,
  fetchDraftOkrObjectiveRemindersForOwner,
  fetchMembershipDisplayNames,
  fetchTasksForMembership,
  mergeMyTasksList,
  resolveSourceObjectTitles,
} from "@/lib/tasks/approval-queries";
import { getApprovalLifecycleEntry } from "@/lib/tasks/approval-lifecycle-registry";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function MyTasksPage({ searchParams }: PageProps) {
  const pageAccess = await getSidebarAccessContext("my-tasks");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const { access } = pageAccess;
  const params = await searchParams;
  const filterRaw = (params.filter ?? "open").trim();
  const filter = filterRaw === "completed" ? "completed" : filterRaw === "all" ? "all" : "open";

  const [tasks, draftOkrReminders] = await Promise.all([
    fetchTasksForMembership(access.organizationId, access.membershipId, filter),
    filter === "completed"
      ? Promise.resolve([])
      : fetchDraftOkrObjectiveRemindersForOwner(access.organizationId, access.membershipId),
  ]);
  const rows = mergeMyTasksList(tasks, draftOkrReminders, filter);
  const titles = await resolveSourceObjectTitles(access.organizationId, tasks);
  const creatorIds = [...new Set(tasks.map((t) => t.created_by_membership_id))];
  const creatorNames = await fetchMembershipDisplayNames(creatorIds);

  const okrObjReg = getApprovalLifecycleEntry("okr_objective");

  return (
    <section className="space-y-4">
      <div className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Meine Aufgaben</h1>
        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <FilterLink href="/my-tasks?filter=open" active={filter === "open"}>
            Offen
          </FilterLink>
          <FilterLink href="/my-tasks?filter=completed" active={filter === "completed"}>
            Erledigt
          </FilterLink>
          <FilterLink href="/my-tasks?filter=all" active={filter === "all"}>
            Alle
          </FilterLink>
        </nav>
      </div>

      <div className="brand-card overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Titel</th>
              <th className="px-4 py-3 font-medium">Typ</th>
              <th className="px-4 py-3 font-medium">Objekt</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Priorität</th>
              <th className="px-4 py-3 font-medium">Einreicher</th>
              <th className="px-4 py-3 font-medium">Routing</th>
              <th className="px-4 py-3 font-medium">Erstellt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  Keine Tasks in dieser Ansicht.
                </td>
              </tr>
            ) : (
              rows.map((entry) => {
                if (entry.kind === "draft_okr") {
                  const d = entry.draft;
                  const href =
                    okrObjReg?.buildDeepLink(d.id, { okrCycleId: d.okr_cycle_id }) ?? "/okr/planning";
                  const listTitle = `OKR «${d.title.trim() || "Ohne Titel"}» — Entwurf fertigstellen`;
                  return (
                    <tr key={`draft-okr-${d.id}`} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <Link href={href} className="text-blue-700 hover:underline">
                          {listTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">OKR-Planung</td>
                      <td className="px-4 py-3 text-zinc-700">
                        {okrObjReg?.table ?? "okr_objectives"}: {d.title.trim() || "(ohne Titel)"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">Entwurf</td>
                      <td className="px-4 py-3 text-zinc-700">—</td>
                      <td className="px-4 py-3 text-zinc-700">—</td>
                      <td className="px-4 py-3 text-zinc-600">—</td>
                      <td className="px-4 py-3 text-zinc-600">
                        {new Date(d.updated_at).toLocaleString("de-DE")}
                      </td>
                    </tr>
                  );
                }
                const t = entry.task;
                const objTitle =
                  titles.get(`${t.source_object_type}:${t.source_object_id}`) ?? "(ohne Titel)";
                const reg = getApprovalLifecycleEntry(t.source_object_type);
                return (
                  <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50/80">
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <Link href={`/my-tasks/${t.id}`} className="text-blue-700 hover:underline">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{t.task_type}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {reg?.table ?? t.source_object_type}: {objTitle}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{t.status}</td>
                    <td className="px-4 py-3 text-zinc-700">{t.priority}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {creatorNames.get(t.created_by_membership_id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {approvalRoutingLabelDe(t.routing_mode)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      {new Date(t.created_at).toLocaleString("de-DE")}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white"
          : "rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-zinc-700 hover:bg-zinc-50"
      }
    >
      {children}
    </Link>
  );
}
