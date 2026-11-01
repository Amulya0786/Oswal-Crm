export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_JOBS === "0" || process.env.VITEST) return;
  const { startScheduler } = await import("./server/jobs");
  startScheduler();
}
