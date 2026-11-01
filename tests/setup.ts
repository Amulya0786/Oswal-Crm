process.env.DATABASE_URL = "file:./test.db";
process.env.AUTH_SECRET ??= "test-auth-secret";
process.env.CRON_SECRET ??= "test-cron-secret";
process.env.APP_URL ??= "http://localhost:3000";
process.env.NOTIFY_DRY_RUN = "1";
for (const key of ["WHATSAPP_CLOUD_TOKEN", "WHATSAPP_CLOUD_PHONE_ID", "GUPSHUP_API_KEY", "GUPSHUP_SRC_NAME", "MSG91_AUTH_KEY", "MSG91_SENDER_ID", "SMTP_URL"]) {
  delete process.env[key];
}
