/**
 * Generische Redaction-Helfer für Tool-Outputs, Prompts, Audit-Logs und
 * Context-Pakete, die an externe Modelle gehen.
 *
 * Logik aus web/lib/analysis-network/storage-log.ts (`redactSensitive`)
 * extrahiert; identisches Verhalten, ohne Storage-Kopplung.
 */

const DEFAULT_SENSITIVE_KEY_PATTERN =
  /(prompt|authorization|api.?key|secret|token|password|cookie|credential|bearer)/i;

const REDACTED_PLACEHOLDER = "[redacted]";
const CIRCULAR_PLACEHOLDER = "[circular]";

export type RedactionOptions = {
  /**
   * RegExp, die auf den Schlüsselnamen matcht. Defaults decken
   * prompt/auth/api-key/secret/token/password/cookie/credential/bearer ab.
   */
  sensitiveKeyPattern?: RegExp;
  /**
   * Zusätzliche Keys, die unabhängig vom Standard-Pattern redigiert werden.
   */
  extraKeysToRedact?: ReadonlyArray<string>;
  /**
   * Wenn true, werden klassifizierte Felder (`hr_*`, `salary_*`) zusätzlich
   * redigiert. Nützlich für externe Modelle.
   */
  redactHrLikeKeys?: boolean;
  /**
   * Wenn true, werden E-Mail-Adressen in Strings maskiert.
   */
  maskEmails?: boolean;
};

const HR_KEY_PATTERN = /(salary|gehalt|hr_|performance_score|kpi_personal|disciplinary)/i;
const EMAIL_PATTERN = /([a-zA-Z0-9_.+-]+)@([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/g;

function shouldRedactKey(key: string, options: RedactionOptions): boolean {
  const lowered = key.toLowerCase();
  const pattern = options.sensitiveKeyPattern ?? DEFAULT_SENSITIVE_KEY_PATTERN;
  if (pattern.test(lowered)) return true;
  if (options.redactHrLikeKeys && HR_KEY_PATTERN.test(lowered)) return true;
  if (options.extraKeysToRedact && options.extraKeysToRedact.some((k) => k.toLowerCase() === lowered)) {
    return true;
  }
  return false;
}

function maskEmailsIn(value: string): string {
  return value.replace(EMAIL_PATTERN, "[email]");
}

function redactInternal(
  value: unknown,
  parentKey: string | null,
  seen: WeakSet<object>,
  options: RedactionOptions
): unknown {
  if (parentKey !== null && shouldRedactKey(parentKey, options)) {
    return REDACTED_PLACEHOLDER;
  }
  if (value == null) return value;
  if (typeof value === "string") {
    return options.maskEmails ? maskEmailsIn(value) : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, parentKey, seen, options));
  }
  if (typeof value !== "object") return value;
  if (seen.has(value)) return CIRCULAR_PLACEHOLDER;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [childKey, childValue] of Object.entries(record)) {
    out[childKey] = redactInternal(childValue, childKey, seen, options);
  }
  return out;
}

export function redactSensitive(value: unknown, options: RedactionOptions = {}): unknown {
  return redactInternal(value, null, new WeakSet<object>(), options);
}

export const REDACTION_PLACEHOLDERS = Object.freeze({
  REDACTED: REDACTED_PLACEHOLDER,
  CIRCULAR: CIRCULAR_PLACEHOLDER,
});
