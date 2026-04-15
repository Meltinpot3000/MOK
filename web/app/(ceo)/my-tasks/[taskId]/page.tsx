import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  approvalRoutingLabelDe,
  fetchMembershipDisplayNames,
  fetchTaskById,
  resolveSourceObjectTitles,
} from "@/lib/tasks/approval-queries";
import { getApprovalLifecycleEntry } from "@/lib/tasks/approval-lifecycle-registry";
import { TaskDecisionForm } from "@/components/ceo/tasks/TaskDecisionForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ taskId: string }> };

export default async function MyTaskDetailPage({ params }: PageProps) {
  const pageAccess = await getSidebarAccessContext("my-tasks");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const { taskId } = await params;
  const { access } = pageAccess;
  const task = await fetchTaskById(access.organizationId, access.membershipId, taskId);
  if (!task) notFound();

  const titles = await resolveSourceObjectTitles(access.organizationId, [task]);
  const objTitle =
    titles.get(`${task.source_object_type}:${task.source_object_id}`) ?? "(ohne Titel)";
  const reg = getApprovalLifecycleEntry(task.source_object_type);
  const deepLink = reg
    ? reg.buildDeepLink(task.source_object_id, { okrCycleId: null })
    : "/dashboard";

  const names = await fetchMembershipDisplayNames([task.created_by_membership_id]);

  let objectStatus: string | null = null;
  if (reg?.table) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .schema("app")
      .from(reg.table)
      .select("status")
      .eq("id", task.source_object_id)
      .eq("organization_id", access.organizationId)
      .maybeSingle();
    objectStatus = (data as { status?: string } | null)?.status ?? null;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="brand-card p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Task</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900">{task.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">{task.description || "—"}</p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Objekttyp</dt>
            <dd className="mt-1 text-zinc-800">{task.source_object_type}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Objekttitel</dt>
            <dd className="mt-1 text-zinc-800">{objTitle}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Objektstatus</dt>
            <dd className="mt-1 text-zinc-800">{objectStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Einreicher</dt>
            <dd className="mt-1 text-zinc-800">
              {names.get(task.created_by_membership_id) ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Routing</dt>
            <dd className="mt-1 text-zinc-800">{approvalRoutingLabelDe(task.routing_mode)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">Task-Status</dt>
            <dd className="mt-1 text-zinc-800">{task.status}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={deepLink}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Zum Objekt
          </Link>
          <Link href="/my-tasks" className="text-sm font-medium text-blue-700 hover:underline">
            Zurück zur Liste
          </Link>
        </div>

        {task.status === "open" && task.task_type === "approval" ? (
          <div className="mt-8 border-t border-zinc-100 pt-6">
            <h2 className="text-sm font-semibold text-zinc-900">Entscheidung</h2>
            <TaskDecisionForm taskId={task.id} />
          </div>
        ) : null}

        {task.decision_comment ? (
          <p className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            Kommentar: {task.decision_comment}
          </p>
        ) : null}
      </div>
    </section>
  );
}
