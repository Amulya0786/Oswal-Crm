import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getFeedback, submitFeedback } from "@/server/complaints";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const feedback = await getFeedback(token);
  if (!feedback) return NextResponse.json({ error: "This feedback link is not valid." }, { status: 404 });
  return NextResponse.json(feedback);
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const body = (await request.json()) as { rating?: number; notes?: string };
    await submitFeedback(token, Number(body.rating), body.notes ?? "");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
