import { openApi } from "@/lib/openapi";
import { getCurrentUser } from "@/server/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.caps.security) return Response.json({ error: "Sign in" }, { status: 401 });
  return Response.json(openApi);
}
