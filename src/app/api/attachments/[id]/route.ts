import { NextResponse } from "next/server";
import { canSeeComplaint } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { withUser } from "@/server/http";

export const GET = withUser(async (user, _request, context) => {
  const { id } = await context.params;
  const attachment = await prisma.attachment.findUnique({ where: { id }, include: { complaint: true } });
  if (!attachment || !canSeeComplaint(user, attachment.complaint)) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const bytes = new Uint8Array(attachment.data);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`,
      "Content-Length": String(bytes.length),
    },
  });
});
