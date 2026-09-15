# AdmitPath

AdmitPath helps Ontario high-school students see where they can realistically get into university or college for a program they want. Students pick a field of study, enter their average and the Grade 12 courses they have taken (or are taking), and every matching program is labeled Safe, Target, Reach, or Unlikely — with an explanation, the exact gap to the next-better label, and concrete ways to improve their chances.

The core student flow:

- Search for a field of study ("comp sci", "nursing"...) — fuzzy matching over category names, aliases, and program names.
- Enter an average and tick off completed/in-progress Grade 12 courses.
- Browse every program in the field, each labeled Safe / Target / Reach / Unlikely with a plain-language explanation.
- Open a program to see prerequisites, supplementary requirements, deadlines, scholarships, and the official source link.

## Requirements

- Node 20 or newer

## Setup

```bash
git clone <repo-url> admitpath
cd admitpath
npm install
npm run setup
npm run dev
```

Then open http://localhost:3000.

`npm run setup` does three things: copies `.env` from `.env.example` if it does not exist, creates the SQLite schema via `prisma db push`, and seeds the database from `data/seed.json` via the importer.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run setup` | One-shot bootstrap: `.env` + schema + seed data |
| `npm run db:push` | Sync `prisma/schema.prisma` to the database |
| `npm run seed` | Re-import `data/seed.json` (idempotent) |
| `npm run import` | Import one or more JSON/CSV data files (see below) |
| `npm run test:rules` | Run the label rules engine tests |

## Label thresholds

Labels are computed by the pure rules engine in `lib/rules.ts` (tested by `scripts/test-rules.ts`). For each program, the latest intake year's numbers are used:

- **Safe** — average >= `competitive_high` AND all required prerequisites met.
- **Target** — `competitive_low` <= average < `competitive_high` AND all required prerequisites met.
- **Reach** — published minimum <= average < `competitive_low`, OR exactly one required prerequisite (group) is missing — even a Safe-level average shows Reach in that case.
- **Unlikely** — average < the published minimum, OR two or more required prerequisites (groups) are missing, regardless of average.

Notes on how prerequisites and partial data are handled:

- A missing required prerequisite always caps the label: one missing group means at best Reach; two or more mean Unlikely.
- "One of A/B/C" prerequisite groups are satisfied by any single course in the group. Recommended courses (`isRequired = false`) never count against a student. Course-code matching is case-insensitive.
- No average entered yet: the label is "Add your grades" rather than a guess.
- A program with a published minimum but no competitive range: meeting the minimum shows Reach, with wording noting that no competitive range is available.
- A program with no published numbers at all: prerequisites met shows Target ("no published cutoff average").

Each assessment also reports the percentage-point gap to the next-better label (e.g. Target -> Safe, Reach -> Target) when grades — not prerequisites — are the blocker.

## Adding programs without touching code

All program data enters through the importer:

```bash
npm run import -- data/myfile.csv
# or several files at once; JSON is always processed before CSV
npm run import -- data/new-institutions.json data/new-programs.csv
```

Imports are idempotent: institutions, categories, and programs are upserted by slug; admission requirements are upserted by (program, year); prerequisites, supplementary requirements, and tips are replaced wholesale for the program that owns them. Re-running the same file never duplicates rows.

Start from the annotated templates: `data/template.json` and `data/template.csv`.

### JSON format (`data/template.json`)

A JSON file is an object with three optional arrays:

- **`institutions`** — `slug`, `name`, `shortName`, `type` (`"university"` | `"college"`), `city`, `province` (default `"ON"`), `country` (default `"CA"`), `website`, `applicationSystem` (`"OUAC"` | `"OCAS"`).
- **`categories`** — `slug`, `name`, `aliases` (array of strings used by the fuzzy search), `description`, and optional `tips` (apply to every program in the category).
- **`programs`** — `institution` and `category` (slugs), `slug`, `name`, `degreeType`, optional `campus`, `url`, optional `notes`, plus:
  - `requirements`: `{ "year": int, "minAverage": num|null, "competitiveLow": num|null, "competitiveHigh": num|null, "sourceUrl", "lastVerified": ISO date, "isEstimated": bool }` — one entry per intake year.
  - `prerequisites`: either a single course `{ "courseCode", "courseName", "minGrade"?, "isRequired"? }` (default required) or an alternatives group `{ "oneOf": [{ "courseCode", "courseName" }, ...], "isRequired"? }` — any ONE course in a `oneOf` group satisfies it.
  - `supplementary`: `{ "kind": "essay"|"portfolio"|"interview"|"video"|"test"|"form", "name", "description"?, "isWeighted": bool }`.
  - `tips`: `{ "kind": "supplementary_focus"|"extracurricular"|"deadline"|"scholarship", "title", "detail", "value"?, "sortOrder"? }` — `value` is an ISO date for deadlines and a threshold average (number as a string) for scholarships.

### CSV format (`data/template.csv`)

One row per program intake, with this exact header:

```
institution,category,slug,name,degree_type,campus,url,notes,year,min_average,competitive_low,competitive_high,source_url,last_verified,is_estimated,prerequisites,supplementary
```

- `institution` and `category` are slugs that must already exist — define them in a JSON file (JSON files in the same `npm run import` invocation are processed first).
- `campus` and `notes` may be empty. An empty `year` cell means the row carries no admission numbers.
- `is_estimated` accepts `true`/`false`, `1`/`0`, or `yes`/`no`.
- **`prerequisites` cell** — e.g. `ENG4U:English|MHF4U/MCV4U/MDM4U:One 4U math|?ICS4U:Computer Science`:
  - `|` separates entries;
  - `/` separates alternatives within an entry (any one satisfies it);
  - `:` prefixes a display name for the entry;
  - a leading `?` marks the entry as recommended rather than required.
- **`supplementary` cell** — e.g. `form:Applicant Questionnaire:weighted|essay:Personal statement`, i.e. `kind:Name` with an optional `:weighted` suffix.
- CSV rows carry no tips; existing tips for the program are left untouched.

## Data honesty

- `is_estimated = true` on an admission requirement means the competitive/safe-zone range is **not officially published** — it is an estimate. The UI must show these numbers with an "estimated" badge and never present them as official. Only the published minimum (when one exists) is official.
- Every requirement row carries a `source_url` and a `last_verified` date. Seed numbers must be re-verified against `source_url` each admission cycle — cutoffs move year to year, and stale numbers are worse than none.

## Database

SQLite via Prisma, stored at `prisma/dev.db` (see `DATABASE_URL` in `.env`). Nothing in the code is SQLite-specific. To swap to Postgres:

1. Change `provider = "sqlite"` to `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` in `.env` at your Postgres instance.
3. Run `npx prisma db push`, then re-seed with `npm run seed`.

## Project structure

```
app/                  Next.js App Router pages and UI
lib/
  db.ts               Prisma client singleton
  types.ts            Serializable DTO shapes (server -> client)
  rules.ts            Label rules engine (pure functions)
  data.ts             Server-side queries -> DTOs
prisma/
  schema.prisma       Database schema
data/
  seed.json           Seed data (real programs)
  template.json       Annotated JSON import template
  template.csv        Annotated CSV import template
scripts/
  import.ts           JSON/CSV importer (idempotent)
  test-rules.ts       Tests for lib/rules.ts
  ensure-env.mjs      Copies .env.example -> .env on first setup
```
