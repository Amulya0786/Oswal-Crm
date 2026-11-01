import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildSampleWorkbook } from "../src/lib/import/sample";

const dir = path.join(process.cwd(), "samples");
mkdirSync(dir, { recursive: true });
const file = path.join(dir, "smartlogics-import.xlsx");
writeFileSync(file, buildSampleWorkbook());
console.log(`Wrote ${file}`);
