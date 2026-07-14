export type StrategicContextScheduleResult =
  | { status: "scheduled" }
  | { status: "already_running" }
  | {
      status: "skipped";
      reason: "llm_disabled" | "profile_incomplete" | "budget_exceeded" | "insert_failed";
      missingFields?: string[];
    };

const MISSING_FIELD_LABELS: Record<string, string> = {
  organization_type: "Organisationsform",
  company_size: "Unternehmensgröße",
  industry: "Industriekontext",
  core_value_creation: "Kern-Wertschöpfung",
  regions: "Marktregionen",
  revenue_current: "Umsatzgröße heute",
  revenue_target: "Umsatzgröße Ziel",
  transformation_status: "Transformation Status",
};

export function appendSentinelScheduleParams(
  params: URLSearchParams,
  result: StrategicContextScheduleResult
): void {
  if (result.status === "scheduled" || result.status === "already_running") {
    params.set("sentinel", "queued");
    return;
  }
  params.set("sentinel", "skipped");
  params.set("sentinel_reason", result.reason);
  if (result.missingFields?.length) {
    params.set("sentinel_missing", result.missingFields.join(","));
  }
}

export function formatMissingCompanyProfileFields(missingFields: string[]): string {
  return missingFields
    .map((field) => MISSING_FIELD_LABELS[field] ?? field)
    .join(", ");
}
