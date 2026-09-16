// CLI importer for AdmitPath program data.
//
// Usage:
//   npx tsx scripts/import.ts <file.json|file.csv> [<file> ...]
//
// JSON files use the shared seed format (see data/seed.json). CSV files use
// a flat one-row-per-program-intake format (header documented below). All
// .json arguments are processed before any .csv argument, regardless of the
// order they were passed, so a CSV can reference institutions and categories
// defined by a JSON file in the same invocation.
//
// Imports are idempotent:
//   - institutions, categories and programs are upserted by slug
//   - admission requirements are upserted by (program, year)
//   - prerequisites, supplementary requirements and tips are replaced
//     wholesale for the program/category that owns them
// so re-running the same import never duplicates rows.

import { existsSync, readFileSync } from "node:fs";
import { prisma } from "../lib/db";

// ---------------------------------------------------------------------------
// Errors, counters, small helpers
// ---------------------------------------------------------------------------

/** A validation problem in the input data — reported without a stack trace. */
class ImportError extends Error {}

const SUPPLEMENTARY_KINDS = ["essay", "portfolio", "interview", "video", "test", "form"];
const TIP_KINDS = ["supplementary_focus", "extracurricular", "deadline", "scholarship"];
const INSTITUTION_TYPES = ["university", "college"];

interface Counter {
  created: number;
  updated: number;
}

const counts = {
  institutions: { created: 0, updated: 0 } as Counter,
  categories: { created: 0, updated: 0 } as Counter,
  programs: { created: 0, updated: 0 } as Counter,
  requirements: 0,
};

// Count each slug once per run even if it appears in several files/rows.
const countedInstitutions = new Set<string>();
const countedCategories = new Set<string>();
const countedPrograms = new Set<string>();

let warnings = 0;
function warn(message: string): void {
  warnings += 1;
  console.warn(`  warning: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Required non-empty string field. */
function reqStr(value: unknown, field: string, ctx: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ImportError(`${ctx}: missing required field "${field}"`);
  }
  return value.trim();
}

/** Optional string field -> string | null. */
function optStr(value: unknown, field: string, ctx: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ImportError(`${ctx}: field "${field}" must be a string`);
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Optional numeric field -> number | null. Accepts numbers or numeric strings. */
function numOrNull(value: unknown, field: string, ctx: string): number | null {
  if (value === undefined || value === null) return null;
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n)) {
    throw new ImportError(`${ctx}: field "${field}" (${JSON.stringify(value)}) is not a number`);
  }
  return n;
}

/** Required integer field. */
function reqInt(value: unknown, field: string, ctx: string): number {
  const n = numOrNull(value, field, ctx);
  if (n === null || !Number.isInteger(n)) {
    throw new ImportError(`${ctx}: field "${field}" (${JSON.stringify(value)}) is not an integer`);
  }
  return n;
}

/** Optional boolean field with a default. */
function boolOr(value: unknown, field: string, ctx: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new ImportError(`${ctx}: field "${field}" must be true or false`);
  return value;
}

/** Required Date-parsable string -> Date. */
function reqDate(value: unknown, field: string, ctx: string): Date {
  const raw = reqStr(value, field, ctx);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ImportError(`${ctx}: field "${field}" ("${raw}") is not a parsable date`);
  }
  return date;
}

// ---------------------------------------------------------------------------
// Normalized shapes shared by the JSON and CSV paths
// ---------------------------------------------------------------------------

interface TipRow {
  kind: string;
  title: string;
  detail: string;
  value: string | null;
  sortOrder: number;
}

interface PrereqCourse {
  courseCode: string;
  courseName: string;
  minGrade: number | null;
}

type PrereqEntry =
  | { oneOf: false; course: PrereqCourse; isRequired: boolean }
  | { oneOf: true; courses: PrereqCourse[]; isRequired: boolean };

interface SupplementaryRow {
  kind: string;
  name: string;
  description: string | null;
  isWeighted: boolean;
}

interface RequirementRow {
  year: number;
  minAverage: number | null;
  competitiveLow: number | null;
  competitiveHigh: number | null;
  sourceUrl: string;
  lastVerified: Date;
  isEstimated: boolean;
}

interface NormalizedProgram {
  institutionSlug: string;
  categorySlug: string;
  slug: string;
  name: string;
  degreeType: string;
  campus: string | null;
  url: string;
  notes: string | null;
  requirements: RequirementRow[];
  /** For each child list, null = leave existing rows untouched (key omitted
   *  in JSON, or an empty CSV cell); an array — even an empty one — replaces
   *  the program's rows wholesale. */
  prerequisites: PrereqEntry[] | null;
  supplementary: SupplementaryRow[] | null;
  tips: TipRow[] | null;
}

// ---------------------------------------------------------------------------
// Slug -> id lookups (cache backed by the DB)
// ---------------------------------------------------------------------------

const institutionIds = new Map<string, string>();
const categoryIds = new Map<string, string>();

async function institutionIdBySlug(slug: string, ctx: string): Promise<string> {
  const cached = institutionIds.get(slug);
  if (cached) return cached;
  const found = await prisma.institution.findUnique({ where: { slug }, select: { id: true } });
  if (!found) {
    throw new ImportError(
      `${ctx}: unknown institution slug "${slug}" — it must be defined in a JSON file (JSON files are always imported before CSV files)`
    );
  }
  institutionIds.set(slug, found.id);
  return found.id;
}

async function categoryIdBySlug(slug: string, ctx: string): Promise<string> {
  const cached = categoryIds.get(slug);
  if (cached) return cached;
  const found = await prisma.programCategory.findUnique({ where: { slug }, select: { id: true } });
  if (!found) {
    throw new ImportError(
      `${ctx}: unknown category slug "${slug}" — it must be defined in a JSON file (JSON files are always imported before CSV files)`
    );
  }
  categoryIds.set(slug, found.id);
  return found.id;
}

// ---------------------------------------------------------------------------
// Shared validation + write logic
// ---------------------------------------------------------------------------

function validateTip(raw: unknown, ctx: string, index: number): TipRow {
  if (!isRecord(raw)) throw new ImportError(`${ctx}: tip #${index + 1} is not an object`);
  const kind = reqStr(raw.kind, "kind", `${ctx} tip #${index + 1}`);
  if (!TIP_KINDS.includes(kind)) {
    throw new ImportError(`${ctx}: tip kind "${kind}" is not one of: ${TIP_KINDS.join(", ")}`);
  }
  return {
    kind,
    title: reqStr(raw.title, "title", `${ctx} tip #${index + 1}`),
    detail: reqStr(raw.detail, "detail", `${ctx} tip #${index + 1}`),
    value: optStr(raw.value, "value", `${ctx} tip #${index + 1}`),
    sortOrder:
      raw.sortOrder === undefined || raw.sortOrder === null
        ? index
        : reqInt(raw.sortOrder, "sortOrder", `${ctx} tip #${index + 1}`),
  };
}

function validateRequirement(row: RequirementRow, ctx: string): void {
  if (
    row.competitiveLow !== null &&
    row.competitiveHigh !== null &&
    row.competitiveLow > row.competitiveHigh
  ) {
    throw new ImportError(
      `${ctx} (year ${row.year}): competitiveLow (${row.competitiveLow}) is greater than competitiveHigh (${row.competitiveHigh})`
    );
  }
  if (row.minAverage !== null && row.competitiveLow !== null && row.minAverage > row.competitiveLow) {
    warn(
      `${ctx} (year ${row.year}): minAverage (${row.minAverage}) is greater than competitiveLow (${row.competitiveLow}) — double-check the data`
    );
  }
  if ((row.competitiveLow === null) !== (row.competitiveHigh === null)) {
    warn(
      `${ctx} (year ${row.year}): only one of competitiveLow/competitiveHigh is set — labels still work, but the range display and explanations are clearest with both`
    );
  }
}

/** Upsert the program row plus all of its child rows. */
async function writeProgram(p: NormalizedProgram, ctx: string): Promise<void> {
  // Validate everything that can fail before writing anything.
  for (const r of p.requirements) validateRequirement(r, ctx);
  const institutionId = await institutionIdBySlug(p.institutionSlug, ctx);
  const categoryId = await categoryIdBySlug(p.categorySlug, ctx);

  const data = {
    name: p.name,
    degreeType: p.degreeType,
    campus: p.campus,
    url: p.url,
    notes: p.notes,
    institutionId,
    categoryId,
  };

  const existing = await prisma.program.findUnique({ where: { slug: p.slug }, select: { id: true } });
  let programId: string;
  if (existing) {
    await prisma.program.update({ where: { id: existing.id }, data });
    programId = existing.id;
    if (!countedPrograms.has(p.slug)) counts.programs.updated += 1;
  } else {
    const created = await prisma.program.create({ data: { slug: p.slug, ...data } });
    programId = created.id;
    if (!countedPrograms.has(p.slug)) counts.programs.created += 1;
  }
  countedPrograms.add(p.slug);

  // Admission requirements: upsert by (programId, year).
  for (const r of p.requirements) {
    await prisma.admissionRequirement.upsert({
      where: { programId_year: { programId, year: r.year } },
      create: { programId, ...r },
      update: {
        minAverage: r.minAverage,
        competitiveLow: r.competitiveLow,
        competitiveHigh: r.competitiveHigh,
        sourceUrl: r.sourceUrl,
        lastVerified: r.lastVerified,
        isEstimated: r.isEstimated,
      },
    });
    counts.requirements += 1;
  }

  // Prerequisites: replace wholesale (when provided); oneOf groups get
  // altGroup 1, 2, ... per program.
  if (p.prerequisites !== null) {
    const prereqRows: {
      programId: string;
      courseCode: string;
      courseName: string;
      minGrade: number | null;
      isRequired: boolean;
      altGroup: number | null;
    }[] = [];
    let altGroup = 0;
    for (const entry of p.prerequisites) {
      if (entry.oneOf) {
        altGroup += 1;
        for (const c of entry.courses) {
          prereqRows.push({ programId, ...c, isRequired: entry.isRequired, altGroup });
        }
      } else {
        prereqRows.push({ programId, ...entry.course, isRequired: entry.isRequired, altGroup: null });
      }
    }
    await prisma.prerequisite.deleteMany({ where: { programId } });
    if (prereqRows.length > 0) await prisma.prerequisite.createMany({ data: prereqRows });
  }

  // Supplementary requirements: replace wholesale (when provided).
  if (p.supplementary !== null) {
    await prisma.supplementaryRequirement.deleteMany({ where: { programId } });
    if (p.supplementary.length > 0) {
      await prisma.supplementaryRequirement.createMany({
        data: p.supplementary.map((s) => ({ programId, ...s })),
      });
    }
  }

  // Program tips: replace wholesale (only when the source provides them).
  if (p.tips !== null) {
    await prisma.improvementTip.deleteMany({ where: { programId } });
    if (p.tips.length > 0) {
      await prisma.improvementTip.createMany({ data: p.tips.map((t) => ({ programId, ...t })) });
    }
  }
}

// ---------------------------------------------------------------------------
// JSON path
// ---------------------------------------------------------------------------

function normalizeJsonPrereq(raw: unknown, ctx: string, index: number): PrereqEntry {
  const entryCtx = `${ctx} prerequisite #${index + 1}`;
  if (!isRecord(raw)) throw new ImportError(`${entryCtx}: not an object`);
  const isRequired = boolOr(raw.isRequired, "isRequired", entryCtx, true);

  if (raw.oneOf !== undefined) {
    if (!Array.isArray(raw.oneOf) || raw.oneOf.length === 0) {
      throw new ImportError(`${entryCtx}: "oneOf" must be a non-empty array of courses`);
    }
    const courses = raw.oneOf.map((c, i) => {
      if (!isRecord(c)) throw new ImportError(`${entryCtx}: oneOf item #${i + 1} is not an object`);
      const courseCode = reqStr(c.courseCode, "courseCode", entryCtx);
      return {
        courseCode,
        courseName: optStr(c.courseName, "courseName", entryCtx) ?? courseCode,
        minGrade: numOrNull(c.minGrade, "minGrade", entryCtx),
      };
    });
    return { oneOf: true, courses, isRequired };
  }

  const courseCode = reqStr(raw.courseCode, "courseCode", entryCtx);
  return {
    oneOf: false,
    course: {
      courseCode,
      courseName: optStr(raw.courseName, "courseName", entryCtx) ?? courseCode,
      minGrade: numOrNull(raw.minGrade, "minGrade", entryCtx),
    },
    isRequired,
  };
}

function normalizeJsonSupplementary(raw: unknown, ctx: string, index: number): SupplementaryRow {
  const entryCtx = `${ctx} supplementary #${index + 1}`;
  if (!isRecord(raw)) throw new ImportError(`${entryCtx}: not an object`);
  const kind = reqStr(raw.kind, "kind", entryCtx);
  if (!SUPPLEMENTARY_KINDS.includes(kind)) {
    throw new ImportError(`${entryCtx}: kind "${kind}" is not one of: ${SUPPLEMENTARY_KINDS.join(", ")}`);
  }
  return {
    kind,
    name: reqStr(raw.name, "name", entryCtx),
    description: optStr(raw.description, "description", entryCtx),
    isWeighted: boolOr(raw.isWeighted, "isWeighted", entryCtx, false),
  };
}

async function importJsonFile(file: string): Promise<void> {
  let root: unknown;
  try {
    root = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (err) {
    throw new ImportError(`${file}: invalid JSON — ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!isRecord(root)) throw new ImportError(`${file}: top level must be a JSON object`);

  for (const key of ["institutions", "categories", "programs"]) {
    if (root[key] !== undefined && !Array.isArray(root[key])) {
      throw new ImportError(`${file}: "${key}" must be an array`);
    }
  }

  // 1. Institutions
  for (const raw of (root.institutions as unknown[] | undefined) ?? []) {
    const ctx = `${file}: institution "${isRecord(raw) && typeof raw.slug === "string" ? raw.slug : "?"}"`;
    if (!isRecord(raw)) throw new ImportError(`${file}: institution entry is not an object`);
    const slug = reqStr(raw.slug, "slug", ctx);
    const type = reqStr(raw.type, "type", ctx);
    if (!INSTITUTION_TYPES.includes(type)) {
      throw new ImportError(`${ctx}: type "${type}" is not one of: ${INSTITUTION_TYPES.join(", ")}`);
    }
    const data = {
      name: reqStr(raw.name, "name", ctx),
      shortName: optStr(raw.shortName, "shortName", ctx),
      type,
      city: reqStr(raw.city, "city", ctx),
      province: optStr(raw.province, "province", ctx) ?? "ON",
      country: optStr(raw.country, "country", ctx) ?? "CA",
      website: reqStr(raw.website, "website", ctx),
      applicationSystem: reqStr(raw.applicationSystem, "applicationSystem", ctx),
    };
    const existing = await prisma.institution.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      await prisma.institution.update({ where: { id: existing.id }, data });
      institutionIds.set(slug, existing.id);
      if (!countedInstitutions.has(slug)) counts.institutions.updated += 1;
    } else {
      const created = await prisma.institution.create({ data: { slug, ...data } });
      institutionIds.set(slug, created.id);
      if (!countedInstitutions.has(slug)) counts.institutions.created += 1;
    }
    countedInstitutions.add(slug);
  }

  // 2. Categories (aliases array stored as a JSON string; optional tips)
  for (const raw of (root.categories as unknown[] | undefined) ?? []) {
    const ctx = `${file}: category "${isRecord(raw) && typeof raw.slug === "string" ? raw.slug : "?"}"`;
    if (!isRecord(raw)) throw new ImportError(`${file}: category entry is not an object`);
    const slug = reqStr(raw.slug, "slug", ctx);
    const aliases = raw.aliases === undefined ? [] : raw.aliases;
    if (!Array.isArray(aliases) || aliases.some((a) => typeof a !== "string")) {
      throw new ImportError(`${ctx}: "aliases" must be an array of strings`);
    }
    const data = {
      name: reqStr(raw.name, "name", ctx),
      aliases: JSON.stringify(aliases),
      description: optStr(raw.description, "description", ctx),
    };
    const existing = await prisma.programCategory.findUnique({ where: { slug }, select: { id: true } });
    let categoryId: string;
    if (existing) {
      await prisma.programCategory.update({ where: { id: existing.id }, data });
      categoryId = existing.id;
      if (!countedCategories.has(slug)) counts.categories.updated += 1;
    } else {
      const created = await prisma.programCategory.create({ data: { slug, ...data } });
      categoryId = created.id;
      if (!countedCategories.has(slug)) counts.categories.created += 1;
    }
    countedCategories.add(slug);
    categoryIds.set(slug, categoryId);

    if (raw.tips !== undefined) {
      if (!Array.isArray(raw.tips)) throw new ImportError(`${ctx}: "tips" must be an array`);
      const tips = raw.tips.map((t, i) => validateTip(t, ctx, i));
      await prisma.improvementTip.deleteMany({ where: { categoryId } });
      if (tips.length > 0) {
        await prisma.improvementTip.createMany({ data: tips.map((t) => ({ categoryId, ...t })) });
      }
    }
  }

  // 3. Programs
  for (const raw of (root.programs as unknown[] | undefined) ?? []) {
    const ctx = `${file}: program "${isRecord(raw) && typeof raw.slug === "string" ? raw.slug : "?"}"`;
    if (!isRecord(raw)) throw new ImportError(`${file}: program entry is not an object`);
    for (const key of ["requirements", "prerequisites", "supplementary", "tips"]) {
      if (raw[key] !== undefined && !Array.isArray(raw[key])) {
        throw new ImportError(`${ctx}: "${key}" must be an array`);
      }
    }
    const requirements = ((raw.requirements as unknown[] | undefined) ?? []).map((r, i): RequirementRow => {
      const reqCtx = `${ctx} requirement #${i + 1}`;
      if (!isRecord(r)) throw new ImportError(`${reqCtx}: not an object`);
      return {
        year: reqInt(r.year, "year", reqCtx),
        minAverage: numOrNull(r.minAverage, "minAverage", reqCtx),
        competitiveLow: numOrNull(r.competitiveLow, "competitiveLow", reqCtx),
        competitiveHigh: numOrNull(r.competitiveHigh, "competitiveHigh", reqCtx),
        sourceUrl: reqStr(r.sourceUrl, "sourceUrl", reqCtx),
        lastVerified: reqDate(r.lastVerified, "lastVerified", reqCtx),
        isEstimated: boolOr(r.isEstimated, "isEstimated", reqCtx, false),
      };
    });

    const program: NormalizedProgram = {
      institutionSlug: reqStr(raw.institution, "institution", ctx),
      categorySlug: reqStr(raw.category, "category", ctx),
      slug: reqStr(raw.slug, "slug", ctx),
      name: reqStr(raw.name, "name", ctx),
      degreeType: reqStr(raw.degreeType, "degreeType", ctx),
      campus: optStr(raw.campus, "campus", ctx),
      url: reqStr(raw.url, "url", ctx),
      notes: optStr(raw.notes, "notes", ctx),
      requirements,
      // Omitted keys leave existing rows untouched; an explicit array
      // (including []) replaces them.
      prerequisites:
        raw.prerequisites === undefined
          ? null
          : (raw.prerequisites as unknown[]).map((p, i) => normalizeJsonPrereq(p, ctx, i)),
      supplementary:
        raw.supplementary === undefined
          ? null
          : (raw.supplementary as unknown[]).map((s, i) => normalizeJsonSupplementary(s, ctx, i)),
      tips:
        raw.tips === undefined
          ? null
          : (raw.tips as unknown[]).map((t, i) => validateTip(t, ctx, i)),
    };
    await writeProgram(program, ctx);
  }
}

// ---------------------------------------------------------------------------
// CSV path
// ---------------------------------------------------------------------------

const CSV_HEADER = [
  "institution",
  "category",
  "slug",
  "name",
  "degree_type",
  "campus",
  "url",
  "notes",
  "year",
  "min_average",
  "competitive_low",
  "competitive_high",
  "source_url",
  "last_verified",
  "is_estimated",
  "prerequisites",
  "supplementary",
];

/** Minimal RFC-4180-ish parser: quoted fields may contain commas, newlines
 *  and doubled quotes; rows end with \n or \r\n. */
function parseCsv(text: string, file: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (inQuotes) throw new ImportError(`${file}: unterminated quoted field at end of file`);
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop blank lines.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function csvNum(cell: string, field: string, ctx: string): number | null {
  const v = cell.trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ImportError(`${ctx}: ${field} "${cell}" is not a number`);
  return n;
}

function csvBool(cell: string, field: string, ctx: string): boolean {
  const v = cell.trim().toLowerCase();
  if (v === "" || v === "false" || v === "0" || v === "no") return false;
  if (v === "true" || v === "1" || v === "yes") return true;
  throw new ImportError(`${ctx}: ${field} "${cell}" is not a boolean (use true/false, 1/0 or yes/no)`);
}

/** "MHF4U/MCV4U:Grade 12 math|?SPH4U:Physics" -> prerequisite entries.
 *  "|" splits entries, "/" separates alternatives (a oneOf group),
 *  ":Name" names the course/group, a leading "?" means recommended-only. */
function parsePrereqCell(cell: string, ctx: string): PrereqEntry[] | null {
  if (cell.trim() === "") return null; // empty cell = leave existing rows untouched
  return cell.split("|").map((rawEntry) => {
    let entry = rawEntry.trim();
    if (entry === "") throw new ImportError(`${ctx}: empty prerequisite entry (check for stray "|")`);
    let isRequired = true;
    if (entry.startsWith("?")) {
      isRequired = false;
      entry = entry.slice(1).trim();
    }
    const colon = entry.indexOf(":");
    const codesPart = colon === -1 ? entry : entry.slice(0, colon);
    const name = colon === -1 ? null : entry.slice(colon + 1).trim() || null;
    const codes = codesPart
      .split("/")
      .map((c) => c.trim())
      .filter((c) => c !== "");
    if (codes.length === 0) {
      throw new ImportError(`${ctx}: prerequisite entry "${rawEntry.trim()}" has no course code`);
    }
    if (codes.length === 1) {
      return {
        oneOf: false,
        course: { courseCode: codes[0], courseName: name ?? codes[0], minGrade: null },
        isRequired,
      };
    }
    return {
      oneOf: true,
      courses: codes.map((c) => ({ courseCode: c, courseName: name ?? c, minGrade: null })),
      isRequired,
    };
  });
}

/** "essay:Personal statement|portfolio:Design portfolio:weighted" -> rows. */
function parseSupplementaryCell(cell: string, ctx: string): SupplementaryRow[] | null {
  if (cell.trim() === "") return null; // empty cell = leave existing rows untouched
  return cell.split("|").map((rawEntry) => {
    const parts = rawEntry.trim().split(":");
    const kind = (parts[0] ?? "").trim();
    if (!SUPPLEMENTARY_KINDS.includes(kind)) {
      throw new ImportError(
        `${ctx}: supplementary kind "${kind}" is not one of: ${SUPPLEMENTARY_KINDS.join(", ")}`
      );
    }
    const name = (parts[1] ?? "").trim();
    if (name === "") {
      throw new ImportError(`${ctx}: supplementary entry "${rawEntry.trim()}" is missing a name (use kind:Name)`);
    }
    let isWeighted = false;
    if (parts.length > 2) {
      const flag = parts.slice(2).join(":").trim().toLowerCase();
      if (flag !== "weighted") {
        throw new ImportError(
          `${ctx}: supplementary entry "${rawEntry.trim()}" — expected ":weighted" as the only suffix, got ":${flag}"`
        );
      }
      isWeighted = true;
    }
    return { kind, name, description: null, isWeighted };
  });
}

async function importCsvFile(file: string): Promise<void> {
  const rows = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""), file);
  if (rows.length === 0) throw new ImportError(`${file}: file is empty`);

  const header = rows[0].map((c) => c.trim());
  if (header.length !== CSV_HEADER.length || header.some((c, i) => c !== CSV_HEADER[i])) {
    throw new ImportError(
      `${file}: unexpected header.\n  expected: ${CSV_HEADER.join(",")}\n  got:      ${header.join(",")}`
    );
  }

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rowNo = r + 1; // 1-based, header is row 1
    if (row.length !== CSV_HEADER.length) {
      throw new ImportError(
        `${file} row ${rowNo}: expected ${CSV_HEADER.length} columns, got ${row.length}`
      );
    }
    const cell = Object.fromEntries(CSV_HEADER.map((name, i) => [name, row[i]])) as Record<
      (typeof CSV_HEADER)[number],
      string
    >;
    const ctx = `${file} row ${rowNo} (program "${cell.slug.trim() || "?"}")`;

    const requirements: RequirementRow[] = [];
    if (cell.year.trim() !== "") {
      const year = csvNum(cell.year, "year", ctx);
      if (year === null || !Number.isInteger(year)) {
        throw new ImportError(`${ctx}: year "${cell.year}" is not an integer`);
      }
      requirements.push({
        year,
        minAverage: csvNum(cell.min_average, "min_average", ctx),
        competitiveLow: csvNum(cell.competitive_low, "competitive_low", ctx),
        competitiveHigh: csvNum(cell.competitive_high, "competitive_high", ctx),
        sourceUrl: reqStr(cell.source_url, "source_url", ctx),
        lastVerified: reqDate(cell.last_verified, "last_verified", ctx),
        isEstimated: csvBool(cell.is_estimated, "is_estimated", ctx),
      });
    }

    const program: NormalizedProgram = {
      institutionSlug: reqStr(cell.institution, "institution", ctx),
      categorySlug: reqStr(cell.category, "category", ctx),
      slug: reqStr(cell.slug, "slug", ctx),
      name: reqStr(cell.name, "name", ctx),
      degreeType: reqStr(cell.degree_type, "degree_type", ctx),
      campus: cell.campus.trim() || null,
      url: reqStr(cell.url, "url", ctx),
      notes: cell.notes.trim() || null,
      requirements,
      prerequisites: parsePrereqCell(cell.prerequisites, ctx),
      supplementary: parseSupplementaryCell(cell.supplementary, ctx),
      tips: null, // the CSV format carries no tips; leave existing ones alone
    };
    await writeProgram(program, ctx);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const fmtCounter = (c: Counter) => `${c.created} created, ${c.updated} updated`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new ImportError(
      "no input files.\n  Usage: npx tsx scripts/import.ts <file.json|file.csv> [<file> ...]"
    );
  }

  const jsonFiles: string[] = [];
  const csvFiles: string[] = [];
  for (const arg of args) {
    const lower = arg.toLowerCase();
    if (lower.endsWith(".json")) jsonFiles.push(arg);
    else if (lower.endsWith(".csv")) csvFiles.push(arg);
    else throw new ImportError(`${arg}: unsupported file type (expected .json or .csv)`);
  }
  for (const f of [...jsonFiles, ...csvFiles]) {
    if (!existsSync(f)) throw new ImportError(`${f}: file not found`);
  }

  // JSON first so CSVs can reference institutions/categories defined there.
  for (const f of jsonFiles) {
    console.log(`Importing ${f} ...`);
    await importJsonFile(f);
  }
  for (const f of csvFiles) {
    console.log(`Importing ${f} ...`);
    await importCsvFile(f);
  }

  console.log("\nImport complete.");
  console.log(`  institutions:           ${fmtCounter(counts.institutions)}`);
  console.log(`  categories:             ${fmtCounter(counts.categories)}`);
  console.log(`  programs:               ${fmtCounter(counts.programs)}`);
  console.log(`  admission requirements: ${counts.requirements} written`);
  if (warnings > 0) console.log(`  warnings:               ${warnings} (see above)`);
}

async function run(): Promise<void> {
  try {
    await main();
  } catch (err) {
    process.exitCode = 1;
    if (err instanceof ImportError) {
      console.error(`\nImport failed: ${err.message}`);
    } else {
      console.error("\nImport failed with an unexpected error:");
      console.error(err);
    }
  } finally {
    await prisma.$disconnect();
  }
}

run();
