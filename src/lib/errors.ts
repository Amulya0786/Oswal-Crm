import { Prisma } from "@prisma/client";

export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.status = status;
  }
}

export function wrapPrisma(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") throw new AppError("A record with this value already exists.");
    if (err.code === "P2003") throw new AppError("This record is in use and cannot be deleted.");
    if (err.code === "P2025") throw new AppError("Record not found.", 404);
  }
  throw err;
}
