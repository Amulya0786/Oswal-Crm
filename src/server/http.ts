import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;
  extra?: unknown;
  constructor(status: number, message: string, extra?: unknown) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message, ...(error.extra ? { ...(error.extra as object) } : {}) }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  }
  console.error(error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || null;
}
