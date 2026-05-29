import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function findAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) {
      break;
    }
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized);
    if (hit?.id) {
      return hit.id;
    }
    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }
  return null;
}

export async function createAuthUserWithoutInvite(params: {
  email: string;
  displayName: string | null;
}): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { ok: false, message: "Service-Role nicht konfiguriert." };
  }

  const existing = await findAuthUserIdByEmail(admin, params.email);
  if (existing) {
    return { ok: true, userId: existing };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    email_confirm: true,
    user_metadata: params.displayName ? { full_name: params.displayName } : undefined,
  });

  if (error || !data.user?.id) {
    return { ok: false, message: error?.message ?? "createUser fehlgeschlagen" };
  }

  return { ok: true, userId: data.user.id };
}
