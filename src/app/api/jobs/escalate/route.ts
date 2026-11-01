import { NextResponse } from "next/server";
import { can } from "@/lib/rbac";
import { getCurrentUser } from "@/server/current-user";
import { runEscalation } from "@/server/escalation";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const user = await getCurrentUser();
  const cronOk = Boolean(secret && header === secret);
  if (!cronOk && (!user || !can(user.role, "runEscalation"))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const result = await runEscalation(user?.id ?? null, { force: Boolean(body.force) && Boolean(user) });
  return NextResponse.json(result);
}
