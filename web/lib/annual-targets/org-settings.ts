import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OrgAnnualTargetSignatureSettings } from "@/lib/annual-targets/types";

export async function getOrgAnnualTargetSignatureSettings(
  organizationId: string
): Promise<OrgAnnualTargetSignatureSettings> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .schema("app")
    .from("organizations")
    .select(
      "annual_targets_require_signature, annual_targets_signature_mode, annual_targets_activation_requires_signed_status"
    )
    .eq("id", organizationId)
    .maybeSingle();

  const mode = data?.annual_targets_signature_mode;
  const signatureMode =
    mode === "internal_acknowledgement" || mode === "external_signature" ? mode : "none";

  return {
    requireSignature: Boolean(data?.annual_targets_require_signature),
    signatureMode,
    activationRequiresSignedStatus:
      data?.annual_targets_activation_requires_signed_status === undefined
        ? true
        : Boolean(data?.annual_targets_activation_requires_signed_status),
  };
}
