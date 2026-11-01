import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getCurrentUser, type CurrentUser } from "./current-user";

type Handler = (user: CurrentUser, request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;

export function withUser(handler: Handler) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
      return await handler(user, request, context);
    } catch (error) {
      if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
      console.error(error);
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new AppError("The request body is not valid JSON.");
  }
}
