#!/usr/bin/env node
/**
 * Check row counts after a DigitalOcean Postgres backup has been restored
 * into a scratch database you already have. This script does not create a
 * database, a cluster, or any other DigitalOcean resource.
 *
 *   RESTORE_DATABASE_URL="postgresql://..." node scripts/restore-test.mjs
 *   RESTORE_DATABASE_URL="postgresql://..." EXPECT_DATABASE_URL="postgresql://..." node scripts/restore-test.mjs
 *   RESTORE_DATABASE_URL="postgresql://..." EXPECT_COUNTS=./counts.json node scripts/restore-test.mjs
 *
 * The connection strings are never printed. A mismatch exits with code 1.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const TABLES = ["Complaint", "Customer", "User", "AuditLog", "ComplaintEvent", "Engineer"];

function compareCounts(actual, expected) {
  const mismatches = [];
  for (const [table, expectedCount] of Object.entries(expected)) {
    const got = actual[table];
    if (got !== expectedCount) mismatches.push({ table, actual: got ?? -1, expected: expectedCount });
  }
  return mismatches;
}

function redact(text) {
  return String(text ?? "").replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://[redacted]");
}

function countDatabase(url) {
  const sql = TABLES.map((name) => `SELECT '${name}' AS t, COUNT(*)::text AS n FROM "${name}"`).join(" UNION ALL ");
  const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-At", "-c", sql], {
    encoding: "utf8",
    env: process.env,
  });
  if (result.error && result.error.code === "ENOENT") {
    console.error("psql is not installed. Install the PostgreSQL client, then run this script again.");
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("Could not count rows in the scratch database.");
    const detail = redact(result.stderr || result.stdout);
    if (detail.trim()) console.error(detail.trim().slice(0, 400));
    process.exit(1);
  }
  const counts = {};
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    const [table, n] = line.split("|");
    counts[table] = Number(n);
  }
  return counts;
}

const restoreUrl = process.env.RESTORE_DATABASE_URL;
if (!restoreUrl) {
  console.error("Set RESTORE_DATABASE_URL to the scratch database. Do not point it at production.");
  process.exit(1);
}

const actual = countDatabase(restoreUrl);
console.log("Scratch database row counts:");
for (const table of TABLES) console.log(`  ${table}: ${actual[table] ?? "missing"}`);

let expected = null;
if (process.env.EXPECT_COUNTS) {
  expected = JSON.parse(readFileSync(process.env.EXPECT_COUNTS, "utf8"));
} else if (process.env.EXPECT_DATABASE_URL) {
  expected = countDatabase(process.env.EXPECT_DATABASE_URL);
  console.log("Comparison database row counts:");
  for (const table of TABLES) console.log(`  ${table}: ${expected[table] ?? "missing"}`);
}

if (!expected) {
  console.log("No EXPECT_DATABASE_URL or EXPECT_COUNTS file, so this was a count only.");
  process.exit(0);
}

const mismatches = compareCounts(actual, expected);
if (!mismatches.length) {
  console.log("Row counts match.");
  process.exit(0);
}
console.error("Row counts do not match:");
for (const row of mismatches) console.error(`  ${row.table}: scratch ${row.actual}, expected ${row.expected}`);
process.exit(1);
