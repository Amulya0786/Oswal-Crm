import { getScope, rejectTemporaryPassword } from "@/server/auth";
import { ageingPdf, ageingWorkbook, loadAgeingReport } from "@/server/ageing-report";

export async function GET(req: Request) {
  const { user } = await getScope();
  if (!user) return Response.json({ error: "Sign in" }, { status: 401 });
  rejectTemporaryPassword(user);
  if (!user.caps.report && !user.caps.analytics) return Response.json({ error: "Reports only" }, { status: 403 });
  const format = new URL(req.url).searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const report = await loadAgeingReport();
  if (format === "pdf") {
    const pdf = ageingPdf(report);
    return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=ageing.pdf" } });
  }
  const file = await ageingWorkbook(report);
  return new Response(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=ageing.xlsx",
    },
  });
}
