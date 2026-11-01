import { openApi } from "@/lib/openapi";

export async function GET() {
  return Response.json(openApi);
}
