export async function register() {
  // Jobs stay on the health route. Importing them here pulls Node modules into this bundle.
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: true,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  const capture = Sentry.captureRequestError as (...input: unknown[]) => Promise<void> | void;
  await capture(...args);
}
