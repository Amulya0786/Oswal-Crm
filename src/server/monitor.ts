/** Optional error hook. Set SENTRY_DSN to forward errors. Leave it unset and this does nothing. */
export async function reportError(error: unknown, where = "app") {
  const dsn = process.env.SENTRY_DSN;
  const message = error instanceof Error ? error.message : String(error);
  if (!dsn) return;
  try {
    await fetch(dsn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, where, at: new Date().toISOString() }),
    });
  } catch {
    /* monitoring must not break the request */
  }
}
