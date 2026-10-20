// Writes the sample athlete's history as a Strong-style CSV for testing the
// history import (F5): npm run seed:csv
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { toStrongCsv } from "@/data/seed/csv";
import { sessions } from "@/data/seed";

const out = join(process.cwd(), "public", "demo", "strong-export.csv");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, toStrongCsv(sessions));
console.log(`Wrote ${sessions.length} sessions to ${out}`);
