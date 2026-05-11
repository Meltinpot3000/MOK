import { redirect } from "next/navigation";

import { AssistantPanel } from "@/components/ai/AssistantPanel";
import { getCurrentUserAccessContext } from "@/lib/rbac/user-access-context";
import { getSidebarAccessContext } from "@/lib/rbac/page-access";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  const access = await getSidebarAccessContext("ai-assistant");
  if (access.state === "unauthenticated") redirect("/login");
  if (access.state === "forbidden") redirect("/no-access");

  const userContext = await getCurrentUserAccessContext();
  if (!userContext) redirect("/no-access");

  const canUse = userContext.permissionCodes.has("ai.assistant.use");
  const canAdmin = userContext.permissionCodes.has("ai.admin_settings.write");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Sentinel Assistant</h1>
        <p className="text-sm text-zinc-600">
          Unternehmensspezifischer Management-Assistent fuer Strategie, OKR, Initiativen, Reviews und Aufgaben.
        </p>
        {canAdmin ? (
          <p className="text-xs">
            <a href="/ai-assistant/admin" className="text-indigo-600 hover:underline">
              Admin-Einstellungen
            </a>
          </p>
        ) : null}
      </header>

      {canUse ? (
        <AssistantPanel
          organizationName={userContext.organizationName}
          permissionCodes={[...userContext.permissionCodes]}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Dir fehlt die Capability <code>ai.assistant.use</code>, um Konversationen zu starten. Bitte
          wende dich an deinen Administrator.
        </div>
      )}
    </div>
  );
}
