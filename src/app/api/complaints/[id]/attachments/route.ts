import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { withUser } from "@/server/http";
import { addAttachment } from "@/server/complaints";

export const POST = withUser(async (user, request, context) => {
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("Choose a file.");
  await addAttachment(id, user, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
  return NextResponse.json({ ok: true });
});
