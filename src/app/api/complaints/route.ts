import { NextResponse } from "next/server";
import { withUser, readJson } from "@/server/http";
import { bookComplaint, type BookInput } from "@/server/complaints";

export const POST = withUser(async (user, request) => {
  const body = await readJson<BookInput>(request);
  const complaint = await bookComplaint(body, user);
  return NextResponse.json({ id: complaint?.id, ticketNumber: complaint?.ticketNumber });
});
