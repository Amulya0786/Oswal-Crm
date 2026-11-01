import { NextResponse } from "next/server";
import { withUser } from "@/server/http";
import { lookupCustomers } from "@/server/complaints";

export const GET = withUser(async (_user, request) => {
  const url = new URL(request.url);
  const matches = await lookupCustomers({ phone: url.searchParams.get("phone") ?? undefined, serial: url.searchParams.get("serial") ?? undefined });
  return NextResponse.json({
    matches: matches.map((match) => ({
      customer: {
        id: match.customer.id,
        name: match.customer.name,
        phone: match.customer.phone,
        email: match.customer.email,
        address: match.customer.address,
        village: match.customer.village,
        stateId: match.customer.stateId,
        districtId: match.customer.districtId,
        areaId: match.customer.areaId,
        pincode: match.customer.pincode,
        state: match.customer.state?.name ?? null,
        district: match.customer.district?.name ?? null,
      },
      asset: match.asset ? { id: match.asset.id, serialNumber: match.asset.serialNumber } : null,
      product: match.product ? { id: match.product.id, name: match.product.name, brandId: match.product.brandId } : null,
    })),
  });
});
