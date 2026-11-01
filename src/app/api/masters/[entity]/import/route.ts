import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { can } from "@/lib/rbac";
import { withUser } from "@/server/http";
import { importMaster } from "@/server/masters/service";

export const POST = withUser(async (user, request, context) => {
  if (!can(user.role, "manageMasters")) throw new AppError("Only an admin can import masters.", 403);
  const { entity } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Choose an Excel or CSV file.");
  if (file.size > 8 * 1024 * 1024) throw new AppError("Files are limited to 8 MB.");
  const result = await importMaster(entity, Buffer.from(await file.arrayBuffer()), user.id);
  return NextResponse.json(result);
});
