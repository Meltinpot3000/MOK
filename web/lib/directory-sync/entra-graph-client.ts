type GraphListResponse<T> = {
  value: T[];
  "@odata.nextLink"?: string;
};

export class EntraGraphError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "EntraGraphError";
  }
}

export async function fetchEntraAccessToken(params: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const url = `https://login.microsoftonline.com/${encodeURIComponent(params.tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new EntraGraphError(`Entra token request failed (${res.status}): ${text.slice(0, 400)}`, res.status);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new EntraGraphError("Entra token response missing access_token");
  }
  return json.access_token;
}

export async function graphGetAllPages<T>(
  accessToken: string,
  initialUrl: string
): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = initialUrl;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new EntraGraphError(`Graph request failed (${res.status}): ${text.slice(0, 400)}`, res.status);
    }

    const json = (await res.json()) as GraphListResponse<T>;
    out.push(...(json.value ?? []));
    url = json["@odata.nextLink"] ?? null;
  }

  return out;
}

export function resolveEntraClientSecret(): string | null {
  return process.env.AZURE_CLIENT_SECRET?.trim() || null;
}
