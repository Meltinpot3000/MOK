import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPhase0Context } from "@/lib/phase0/queries";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";
import {
  deleteGroupRoleMapping,
  runDirectorySyncApply,
  runDirectorySyncPreview,
  saveDirectoryConnection,
  saveGroupRoleMapping,
} from "@/lib/directory-sync/actions";
import type { DiffEntry } from "@/lib/directory-sync/types";

type PageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
    runId?: string;
  }>;
};

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: "Neu",
    update: "Aktualisieren",
    archive: "Archivieren",
    skip: "Überspringen",
    delete: "Löschen",
  };
  return map[action] ?? action;
}

export default async function DirectorySyncPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const pageAccess = await getSidebarAccessContext("directory-sync");
  if (pageAccess.state === "unauthenticated") redirect("/login");
  if (pageAccess.state === "forbidden") redirect("/no-access");

  const context = await getPhase0Context();
  if (!context) redirect("/no-access");

  const canWrite = pageAccess.canWrite;
  const supabase = await createSupabaseServerClient();

  const { data: connection } = await supabase
    .schema("app")
    .from("directory_connections")
    .select(
      "id, sync_enabled, azure_tenant_id, client_id, user_provisioning_policy, department_path_separator, last_sync_at, last_preview_run_id, last_error"
    )
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  const { data: roles } = await supabase
    .schema("rbac")
    .from("roles")
    .select("id, code, name")
    .eq("organization_id", context.organizationId)
    .order("name");

  const { data: groupMappings } = await supabase
    .schema("app")
    .from("directory_group_role_mappings")
    .select("id, entra_group_id, entra_group_display_name, role_id")
    .eq("organization_id", context.organizationId);

  const roleById = new Map((roles ?? []).map((r) => [r.id, r]));

  const { data: recentRuns } = await supabase
    .schema("app")
    .from("directory_sync_runs")
    .select("id, mode, status, started_at, completed_at, error_message, diff_summary, stats")
    .eq("organization_id", context.organizationId)
    .order("started_at", { ascending: false })
    .limit(8);

  const highlightRunId = sp.runId ?? connection?.last_preview_run_id ?? null;
  const highlightRun = (recentRuns ?? []).find((r) => r.id === highlightRunId) ?? recentRuns?.[0];

  const diffEntries: DiffEntry[] =
    highlightRun?.diff_summary &&
    typeof highlightRun.diff_summary === "object" &&
    Array.isArray((highlightRun.diff_summary as { entries?: DiffEntry[] }).entries)
      ? ((highlightRun.diff_summary as { entries: DiffEntry[] }).entries ?? [])
      : [];

  const secretConfigured = Boolean(process.env.AZURE_CLIENT_SECRET?.trim());

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Entra ID (optional)</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Die Anwendung funktioniert vollständig ohne Entra. Hier können Sie optional Benutzer,
          Organisationsattribute, Manager-Beziehungen und Gruppenrollen aus Microsoft Entra synchronisieren.
          Jeder Lauf startet als <strong>Vorschau</strong>; Änderungen werden erst nach explizitem Übernehmen geschrieben.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Manuelle Pflege unter{" "}
          <Link href="/invitations" className="underline">
            Benutzer
          </Link>
          ,{" "}
          <Link href="/organization" className="underline">
            Organisationsstruktur
          </Link>{" "}
          und{" "}
          <Link href="/responsibles" className="underline">
            Verantwortliche
          </Link>{" "}
          bleibt jederzeit möglich.
        </p>
      </div>

      {sp.success && (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Aktion erfolgreich ({sp.success}).
        </p>
      )}
      {sp.error && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {decodeURIComponent(sp.error)}
        </p>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Verbindung</h2>
        {!secretConfigured && (
          <p className="mt-2 text-sm text-amber-800">
            <code className="text-xs">AZURE_CLIENT_SECRET</code> ist nicht gesetzt — Graph-Zugriff ist erst nach
            Konfiguration in <code className="text-xs">.env.local</code> möglich.
          </p>
        )}
        {connection?.last_error && (
          <p className="mt-2 text-sm text-red-700">Letzter Fehler: {connection.last_error}</p>
        )}
        <form action={saveDirectoryConnection} className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="text-zinc-600">Azure Tenant ID</span>
            <input
              name="azure_tenant_id"
              defaultValue={connection?.azure_tenant_id ?? ""}
              disabled={!canWrite}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Application (Client) ID</span>
            <input
              name="client_id"
              defaultValue={connection?.client_id ?? ""}
              disabled={!canWrite}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">User-Provisioning</span>
            <select
              name="user_provisioning_policy"
              defaultValue={connection?.user_provisioning_policy ?? "invite_only"}
              disabled={!canWrite}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="none">none — nur Struktur/Rollen, keine Accounts</option>
              <option value="invite_only">invite_only — Einladung per E-Mail</option>
              <option value="create_auth_user">create_auth_user — Auth-User sofort anlegen</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-600">Pfad-Trennzeichen (z. B. « / » für «Vertrieb / DACH»)</span>
            <input
              name="department_path_separator"
              defaultValue={connection?.department_path_separator ?? ""}
              disabled={!canWrite}
              placeholder="/"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="sync_enabled"
              defaultChecked={connection?.sync_enabled ?? false}
              disabled={!canWrite}
            />
            Sync aktiviert (Apply erlaubt)
          </label>
          {canWrite && (
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Verbindung speichern
            </button>
          )}
        </form>
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Gruppen → App-Rollen</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Nur konfigurierte Entra-Gruppen steuern <code className="text-xs">member_roles</code> mit{" "}
          <code className="text-xs">assignment_source=entra_sync</code>. Manuelle Rollen werden nicht entfernt.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {(groupMappings ?? []).map((row) => {
            const role = roleById.get(row.role_id);
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-100 px-3 py-2">
                <span>
                  <code className="text-xs">{row.entra_group_id}</code>
                  {row.entra_group_display_name ? ` — ${row.entra_group_display_name}` : ""} →{" "}
                  <strong>{role?.name ?? role?.code ?? row.role_id}</strong>
                </span>
                {canWrite && (
                  <form action={deleteGroupRoleMapping}>
                    <input type="hidden" name="mapping_id" value={row.id} />
                    <button type="submit" className="text-xs text-red-700 hover:underline">
                      Entfernen
                    </button>
                  </form>
                )}
              </li>
            );
          })}
          {(groupMappings ?? []).length === 0 && (
            <li className="text-zinc-500">Noch keine Gruppen-Zuordnungen.</li>
          )}
        </ul>
        {canWrite && (
          <form action={saveGroupRoleMapping} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              name="entra_group_id"
              placeholder="Entra Group Object ID"
              required
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="entra_group_display_name"
              placeholder="Anzeigename (optional)"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <select name="role_id" required className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="">Rolle wählen…</option>
              {(roles ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="sm:col-span-3 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            >
              Zuordnung hinzufügen
            </button>
          </form>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-zinc-900">Synchronisation</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Zuletzt: Preview-Run{" "}
          {connection?.last_preview_run_id ? (
            <code className="text-xs">{connection.last_preview_run_id}</code>
          ) : (
            "—"
          )}
          {connection?.last_sync_at && (
            <> · Apply: {new Date(connection.last_sync_at).toLocaleString("de-DE")}</>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {canWrite && (
            <form action={runDirectorySyncPreview}>
              <button
                type="submit"
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Vorschau starten
              </button>
            </form>
          )}
          {canWrite && connection?.sync_enabled && connection?.last_preview_run_id && (
            <form action={runDirectorySyncApply}>
              <input type="hidden" name="preview_run_id" value={connection.last_preview_run_id} />
              <button
                type="submit"
                className="rounded-md border border-zinc-900 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Änderungen übernehmen (Apply)
              </button>
            </form>
          )}
        </div>

        {highlightRun && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-zinc-800">
              {highlightRun.mode === "preview" ? "Vorschau" : "Apply"} · {highlightRun.status} ·{" "}
              {new Date(highlightRun.started_at).toLocaleString("de-DE")}
            </h3>
            {highlightRun.error_message && (
              <p className="mt-1 text-sm text-red-700">{highlightRun.error_message}</p>
            )}
            {diffEntries.length > 0 && (
              <div className="mt-3 max-h-96 overflow-auto rounded border border-zinc-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-600">
                    <tr>
                      <th className="px-2 py-1">Aktion</th>
                      <th className="px-2 py-1">Entität</th>
                      <th className="px-2 py-1">Schlüssel</th>
                      <th className="px-2 py-1">Hinweis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffEntries.slice(0, 200).map((e, i) => (
                      <tr key={`${e.entity}-${e.key}-${i}`} className="border-t border-zinc-50">
                        <td className="px-2 py-1">{actionLabel(e.action)}</td>
                        <td className="px-2 py-1">{e.entity}</td>
                        <td className="px-2 py-1 font-mono">{e.key}</td>
                        <td className="px-2 py-1 text-zinc-500">{e.reason ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {diffEntries.length > 200 && (
                  <p className="px-2 py-1 text-xs text-zinc-500">… {diffEntries.length - 200} weitere Einträge</p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
