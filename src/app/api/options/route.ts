import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { withUser } from "@/server/http";
import { OPTION_MODELS } from "@/server/masters/registry";
import { optionList } from "@/server/masters/service";

export const GET = withUser(async (_user, request) => {
  const url = new URL(request.url);
  const model = url.searchParams.get("model") ?? "";
  const label = url.searchParams.get("label") ?? "name";
  if (!(OPTION_MODELS as readonly string[]).includes(model)) throw new AppError("Unknown list.", 404);
  if (!/^[A-Za-z]+$/.test(label)) throw new AppError("Unknown label.");
  const filters: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (key === "model" || key === "label" || !/^[A-Za-z]+$/.test(key)) continue;
    filters[key] = value;
  }
  return NextResponse.json({ options: await optionList(model, label, filters) });
});
