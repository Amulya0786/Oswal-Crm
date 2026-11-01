export async function register() {
  // Escalation and summary jobs run from /api/cron. They are not started here:
  // importing the job module into this hook makes the dev server fail to boot.
}
