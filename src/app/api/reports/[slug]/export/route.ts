import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/rbac";
import { withUser } from "@/server/http";
import { runReport, workbookBuffer } from "@/server/reports";

export const GET = withUser(async (user, request, context) => {
  if (!can(user.role, "exportReports")) throw new AppError("You cannot export reports.", 403);
  const { slug } = await context.params;
  const url = new URL(request.url);
  const filters = Object.fromEntries(url.searchParams.entries());
  const report = await runReport(slug, user, filters);
  const body = workbookBuffer(report.title, report.columns, report.rows);
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}.xlsx"`,
    },
  });
});
