/**
 * CORS_ORIGINS is a comma-separated allowlist of browser origins (e.g. the deployed frontend).
 * Unset or empty keeps the permissive default for local development; in production set it.
 * Origins are compared exactly (scheme + host + port), so trailing slashes are ignored but nothing else is.
 */
export function parseCorsOrigins(raw: string | undefined): string[] | null {
  const origins = (raw ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length > 0 ? origins : null;
}

export function corsOptions(raw: string | undefined) {
  const allowed = parseCorsOrigins(raw);
  // null -> reflect any origin (local development); otherwise only the listed origins
  return allowed ? { origin: allowed } : {};
}
