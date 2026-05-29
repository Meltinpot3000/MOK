export type UserProvisioningPolicy = "none" | "invite_only" | "create_auth_user";

export type DirectorySyncMode = "preview" | "apply";

export type DiffAction = "create" | "update" | "archive" | "skip" | "delete";

export type DiffEntry = {
  action: DiffAction;
  entity: string;
  key: string;
  reason?: string;
  details?: Record<string, unknown>;
};

export type DirectoryConnectionRow = {
  id: string;
  organization_id: string;
  provider: string;
  sync_enabled: boolean;
  azure_tenant_id: string | null;
  client_id: string | null;
  user_provisioning_policy: UserProvisioningPolicy;
  attribute_priority: string[];
  department_path_separator: string | null;
  last_sync_at: string | null;
  last_preview_run_id: string | null;
  last_error: string | null;
};

export type EntraGraphUser = {
  id: string;
  mail: string | null;
  userPrincipalName: string | null;
  displayName: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  companyName: string | null;
  accountEnabled: boolean;
  managerId: string | null;
};

export type EntraGroupMember = {
  groupId: string;
  userId: string;
};

export type DirectorySyncDiffSummary = {
  entries: DiffEntry[];
  counts: Record<DiffAction, number>;
};

export type DirectorySyncRunResult = {
  runId: string;
  mode: DirectorySyncMode;
  status: "completed" | "failed";
  diffSummary: DirectorySyncDiffSummary;
  errorMessage?: string;
};
