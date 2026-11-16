/** Forward an error to Sentry when SENTRY_DSN is set. Leave the variable unset and this does nothing. */
export async function reportError(error: unknown, where = "app") {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    if (!Sentry.getClient()) {
      Sentry.init({ dsn, enabled: true, tracesSampleRate: 0, sendDefaultPii: false });
    }
    Sentry.captureException(error, { tags: { where } });
  } catch {
    /* monitoring must not break the request */
  }
}
