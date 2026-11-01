import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { IMPORT_TARGETS, suggestMapping, type ImportEntity } from "@/lib/import/targets";
import { can } from "@/lib/rbac";
import { readJson, withUser } from "@/server/http";
import { readSheet, runImport } from "@/server/importer";

const ENTITIES = new Set<ImportEntity>(["complaints", "customers", "products", "users"]);
const dir = path.join(process.cwd(), "data", "imports");

function asEntity(value: string): ImportEntity {
  if (!ENTITIES.has(value as ImportEntity)) throw new AppError("Choose complaints, customers, products or users.");
  return value as ImportEntity;
}

export const POST = withUser(async (user, request) => {
  if (!can(user.role, "importData")) throw new AppError("Only an admin can import Smartlogics data.", 403);
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    const entity = asEntity(String(form.get("entity") ?? "complaints"));
    if (!(file instanceof File)) throw new AppError("Choose an Excel or CSV file.");
    if (file.size > 8 * 1024 * 1024) throw new AppError("Files are limited to 8 MB.");
    const token = randomUUID();
    const bytes = Buffer.from(await file.arrayBuffer());
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${token}.bin`), bytes);
    const parsed = readSheet(bytes, entity, String(form.get("sheet") ?? "") || undefined);
    const mapping = suggestMapping(parsed.headers, IMPORT_TARGETS[entity].fields);
    const result = await runImport({ entity, rows: parsed.rows, mapping, user, write: false });
    return NextResponse.json({ token, sheets: parsed.sheets, sheet: parsed.sheet, headers: parsed.headers, mapping, fields: IMPORT_TARGETS[entity].fields, ...result });
  }

  const body = await readJson<{ token?: string; entity?: string; sheet?: string; mapping?: Record<string, string>; write?: boolean }>(request);
  if (!body.token || !/^[0-9a-f-]{36}$/i.test(body.token)) throw new AppError("Upload the file again.", 404);
  const entity = asEntity(body.entity ?? "");
  const bytes = await readFile(path.join(dir, `${body.token}.bin`)).catch(() => {
    throw new AppError("That upload has expired. Choose the file again.", 404);
  });
  const parsed = readSheet(bytes, entity, body.sheet);
  const mapping = body.mapping ?? suggestMapping(parsed.headers, IMPORT_TARGETS[entity].fields);
  const result = await runImport({ entity, rows: parsed.rows, mapping, user, write: Boolean(body.write) });
  return NextResponse.json({ token: body.token, sheets: parsed.sheets, sheet: parsed.sheet, headers: parsed.headers, mapping, fields: IMPORT_TARGETS[entity].fields, ...result });
});
