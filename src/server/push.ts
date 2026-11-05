/** Push adapter. Logs until FCM or APNs keys are set. */
export async function sendPush(input: { token?: string | null; title: string; body: string }) {
  if (!input.token) return { provider: "mock", status: "SKIPPED" };
  if (process.env.FCM_SERVER_KEY || process.env.APNS_KEY_ID) {
    return { provider: process.env.FCM_SERVER_KEY ? "fcm" : "apns", status: "CONFIGURED" };
  }
  console.log(`[push] ${input.title} | ${input.body}`);
  return { provider: "mock", status: "LOGGED" };
}
