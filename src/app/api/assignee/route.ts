import { NextResponse } from "next/server";
import { withUser } from "@/server/http";
import { suggestAssignee } from "@/server/complaints";

export const GET = withUser(async (_user, request) => {
  const url = new URL(request.url);
  const result = await suggestAssignee(url.searchParams.get("pincode"), url.searchParams.get("districtId"));
  return NextResponse.json({
    reason: result.reason,
    serviceCenter: result.serviceCenter
      ? { id: result.serviceCenter.id, name: result.serviceCenter.name, engineerName: result.serviceCenter.engineerName }
      : null,
  });
});
