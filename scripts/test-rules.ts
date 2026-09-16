// Dependency-free tests for the label rules engine (lib/rules.ts).
//
// Run with:  npx tsx scripts/test-rules.ts   (or: npm run test:rules)
// Exits 1 if any test fails.

import assert from "node:assert/strict";
import {
  assessProgram,
  prereqGroups,
  groupLabel,
  LABEL_META,
  type StudentProfile,
} from "../lib/rules";
import type { PrereqDTO, RequirementDTO } from "../lib/types";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let nextId = 0;

function prereq(
  courseCode: string,
  opts: Partial<Omit<PrereqDTO, "id" | "courseCode">> = {}
): PrereqDTO {
  nextId += 1;
  return {
    id: `p${nextId}`,
    courseCode,
    courseName: opts.courseName ?? courseCode,
    minGrade: opts.minGrade ?? null,
    isRequired: opts.isRequired ?? true,
    altGroup: opts.altGroup ?? null,
  };
}

function requirement(overrides: Partial<RequirementDTO> = {}): RequirementDTO {
  return {
    year: 2027,
    minAverage: 70,
    competitiveLow: 80,
    competitiveHigh: 90,
    sourceUrl: "https://example.edu/admissions",
    lastVerified: "2026-09-01T00:00:00.000Z",
    isEstimated: false,
    ...overrides,
  };
}

function student(average: number | null, courses: string[] = []): StudentProfile {
  return { average, courses };
}

// Standard fixtures: min 70, competitive 80–90; ENG4U required,
// one-of-three math group required, ICS4U recommended only.
const REQ = requirement();
const ENG = prereq("ENG4U", { courseName: "English" });
const MATH_GROUP = [
  prereq("MHF4U", { altGroup: 1 }),
  prereq("MCV4U", { altGroup: 1 }),
  prereq("MDM4U", { altGroup: 1 }),
];
const ICS_RECOMMENDED = prereq("ICS4U", { isRequired: false });
const ALL_PREREQS = [ENG, ...MATH_GROUP, ICS_RECOMMENDED];
const ALL_COURSES = ["ENG4U", "MCV4U"]; // satisfies both required groups

function assertClose(actual: number | null, expected: number, what: string): void {
  assert.ok(
    actual !== null && Math.abs(actual - expected) < 1e-9,
    `${what}: expected ~${expected}, got ${actual}`
  );
}

// ---------------------------------------------------------------------------
// Tiny runner
// ---------------------------------------------------------------------------

const tests: { name: string; fn: () => void }[] = [];
function test(name: string, fn: () => void): void {
  tests.push({ name, fn });
}

// ---------------------------------------------------------------------------
// Grade bands and boundaries (all required prereqs met)
// ---------------------------------------------------------------------------

test("exactly at competitiveHigh (90) -> safe", () => {
  const a = assessProgram(student(90, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "safe");
  assert.equal(a.gradeGapToNext, null);
  assert.equal(a.nextLabel, null);
  assert.ok(a.explanation.includes("90%"), `explanation mentions 90%: ${a.explanation}`);
});

test("just below competitiveHigh (89.9) -> target, gap ~0.1 to safe", () => {
  const a = assessProgram(student(89.9, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "target");
  assertClose(a.gradeGapToNext, 0.1, "gradeGapToNext");
  assert.equal(a.nextLabel, "safe");
});

test("exactly at competitiveLow (80) -> target, gap 10 to safe", () => {
  const a = assessProgram(student(80, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "target");
  assertClose(a.gradeGapToNext, 10, "gradeGapToNext");
  assert.equal(a.nextLabel, "safe");
  assert.ok(a.explanation.includes("80"), `explanation mentions 80: ${a.explanation}`);
  assert.ok(a.explanation.includes("90"), `explanation mentions 90: ${a.explanation}`);
});

test("just below competitiveLow (79.9) -> reach, gap ~0.1 to target", () => {
  const a = assessProgram(student(79.9, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assertClose(a.gradeGapToNext, 0.1, "gradeGapToNext");
  assert.equal(a.nextLabel, "target");
});

test("exactly at minAverage (70) -> reach, gap 10 to target", () => {
  const a = assessProgram(student(70, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assertClose(a.gradeGapToNext, 10, "gradeGapToNext");
  assert.equal(a.nextLabel, "target");
});

test("just below minAverage (69.9) -> unlikely, gap ~0.1 to reach", () => {
  const a = assessProgram(student(69.9, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "unlikely");
  assertClose(a.gradeGapToNext, 0.1, "gradeGapToNext");
  assert.equal(a.nextLabel, "reach");
  assert.ok(a.explanation.includes("0.1%"), `explanation mentions the 0.1% gap: ${a.explanation}`);
  assert.ok(a.explanation.includes("70%"), `explanation mentions the 70% minimum: ${a.explanation}`);
});

test("well below minimum (55) -> unlikely, explanation carries both numbers", () => {
  const a = assessProgram(student(55, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "unlikely");
  assert.ok(a.explanation.includes("15%"), `explanation mentions the 15% gap: ${a.explanation}`);
  assert.ok(a.explanation.includes("70%"), `explanation mentions the 70% minimum: ${a.explanation}`);
});

test("safe explanation contains the average and the safe-zone threshold", () => {
  const a = assessProgram(student(92.5, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "safe");
  assert.ok(a.explanation.includes("92.5%"), `explanation mentions 92.5%: ${a.explanation}`);
  assert.ok(a.explanation.includes("90%+"), `explanation mentions 90%+: ${a.explanation}`);
});

test("target explanation contains the average and the competitive range", () => {
  const a = assessProgram(student(85, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "target");
  assert.ok(a.explanation.includes("85%"), `explanation mentions 85%: ${a.explanation}`);
  assert.ok(a.explanation.includes("80–90%"), `explanation mentions 80–90%: ${a.explanation}`);
});

// ---------------------------------------------------------------------------
// Missing prerequisites cap the label
// ---------------------------------------------------------------------------

test("one missing required group caps at reach even with a safe-level average", () => {
  // 95% is well above competitiveHigh, but the math group is missing —
  // completing it alone would land the student at Safe.
  const a = assessProgram(student(95, ["ENG4U"]), REQ, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assert.deepEqual(a.missingGroups, ["MHF4U or MCV4U or MDM4U"]);
  assert.equal(a.nextLabel, "safe");
  assert.equal(a.gradeGapToNext, null); // prereqs, not grades, are the blocker
  assert.ok(a.explanation.includes("MHF4U or MCV4U or MDM4U"), a.explanation);
});

test("one missing group with an in-range average -> next label target, no grade gap", () => {
  const a = assessProgram(student(85, ["ENG4U"]), REQ, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assert.equal(a.nextLabel, "target");
  assert.equal(a.gradeGapToNext, null);
});

test("one missing group while below the competitive range mentions both problems and carries the gap", () => {
  const a = assessProgram(student(75, ["ENG4U"]), REQ, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assert.ok(a.explanation.includes("missing"), a.explanation);
  assert.ok(a.explanation.includes("5%"), `explanation mentions the 5% gap: ${a.explanation}`);
  // Both blockers are reported so the UI can name both steps honestly.
  assertClose(a.gradeGapToNext, 5, "gradeGapToNext");
  assert.equal(a.nextLabel, "target");
});

test("two missing groups -> unlikely regardless of average", () => {
  const a = assessProgram(student(99, []), REQ, ALL_PREREQS);
  assert.equal(a.label, "unlikely");
  assert.equal(a.missingGroups.length, 2);
  assert.ok(a.explanation.includes("2 required courses"), a.explanation);
  assert.ok(a.explanation.includes("ENG4U"), a.explanation);
});

test("an altGroup is satisfied by ANY one member", () => {
  for (const code of ["MHF4U", "MCV4U", "MDM4U"]) {
    const a = assessProgram(student(92, ["ENG4U", code]), REQ, ALL_PREREQS);
    assert.equal(a.label, "safe", `expected safe when holding ${code}, got ${a.label}`);
    assert.deepEqual(a.missingGroups, [], `no missing groups when holding ${code}`);
  }
});

test("recommended (isRequired=false) courses are never counted missing", () => {
  // ICS4U is not in the student's courses, but it is only recommended.
  const a = assessProgram(student(92, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "safe");
  assert.deepEqual(a.missingGroups, []);
  // A program with ONLY recommended courses has nothing missing at all.
  const b = assessProgram(student(92, []), REQ, [ICS_RECOMMENDED]);
  assert.equal(b.label, "safe");
  assert.deepEqual(b.missingGroups, []);
});

test("course-code matching is case-insensitive (both directions)", () => {
  const lowerProfile = assessProgram(student(92, ["eng4u", "mcv4u"]), REQ, ALL_PREREQS);
  assert.equal(lowerProfile.label, "safe");
  assert.deepEqual(lowerProfile.missingGroups, []);

  const lowerPrereqs = [prereq("eng4u"), prereq("mhf4u", { altGroup: 1 }), prereq("mcv4u", { altGroup: 1 })];
  const upperProfile = assessProgram(student(92, ["ENG4U", "MHF4U"]), REQ, lowerPrereqs);
  assert.equal(upperProfile.label, "safe");
  assert.deepEqual(upperProfile.missingGroups, []);
});

// ---------------------------------------------------------------------------
// Missing / partial data
// ---------------------------------------------------------------------------

test("average null -> unknown, prompting for grades", () => {
  const a = assessProgram(student(null, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "unknown");
  assert.ok(a.explanation.includes("average"), a.explanation);
  assert.equal(a.gradeGapToNext, null);
  assert.equal(a.nextLabel, null);
});

test("average null -> unknown even with missing prereqs", () => {
  const a = assessProgram(student(null, []), REQ, ALL_PREREQS);
  assert.equal(a.label, "unknown");
});

test("requirement null with prereqs met -> target (no published cutoff)", () => {
  const a = assessProgram(student(75, ALL_COURSES), null, ALL_PREREQS);
  assert.equal(a.label, "target");
  assert.ok(a.explanation.includes("no published cutoff average"), a.explanation);
  assert.equal(a.gradeGapToNext, null);
  assert.equal(a.nextLabel, null);
});

test("minAverage present, competitive range null: meeting min -> reach, 'no competitive range' wording", () => {
  const req = requirement({ minAverage: 70, competitiveLow: null, competitiveHigh: null });
  const a = assessProgram(student(82, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assert.ok(a.explanation.includes("published minimum of 70%"), a.explanation);
  assert.ok(a.explanation.includes("no competitive range"), a.explanation);
  // With no range there is no better label to compute a gap toward.
  assert.equal(a.gradeGapToNext, null);
  assert.equal(a.nextLabel, null);

  // Exactly at the minimum behaves the same way.
  const b = assessProgram(student(70, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(b.label, "reach");
  assert.ok(b.explanation.includes("no competitive range"), b.explanation);
});

test("min null but competitive range present, below the range -> reach toward target", () => {
  const req = requirement({ minAverage: null, competitiveLow: 80, competitiveHigh: 90 });
  const a = assessProgram(student(76, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assertClose(a.gradeGapToNext, 4, "gradeGapToNext");
  assert.equal(a.nextLabel, "target");
  assert.ok(a.explanation.includes("4%"), `explanation mentions the 4% gap: ${a.explanation}`);
});

test("competitiveLow present but high null: at/above low -> target with threshold wording, no next label", () => {
  const req = requirement({ minAverage: 70, competitiveLow: 80, competitiveHigh: null });
  const a = assessProgram(student(84, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(a.label, "target");
  assert.ok(a.explanation.includes("competitive threshold of 80%"), a.explanation);
  assert.equal(a.gradeGapToNext, null);
  assert.equal(a.nextLabel, null);
});

test("min + competitiveHigh but no competitiveLow: meeting min -> reach with gap to the safe zone", () => {
  const req = requirement({ minAverage: 70, competitiveLow: null, competitiveHigh: 90 });
  const a = assessProgram(student(85, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assertClose(a.gradeGapToNext, 5, "gradeGapToNext");
  assert.equal(a.nextLabel, "safe");
  assert.ok(a.explanation.includes("5%"), `explanation mentions the 5% gap: ${a.explanation}`);
  assert.ok(a.explanation.includes("safe zone of 90%"), a.explanation);
  assert.ok(!a.explanation.includes("-"), `no negative numbers: ${a.explanation}`);
  // At or above high still wins: safe.
  const b = assessProgram(student(91, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(b.label, "safe");
});

test("only competitiveHigh published: below it -> reach with gap to safe, sane wording", () => {
  const req = requirement({ minAverage: null, competitiveLow: null, competitiveHigh: 90 });
  const a = assessProgram(student(85, ALL_COURSES), req, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assertClose(a.gradeGapToNext, 5, "gradeGapToNext");
  assert.equal(a.nextLabel, "safe");
  assert.ok(a.explanation.includes("safe zone of 90%"), a.explanation);
  assert.ok(!a.explanation.includes("-"), `no negative numbers: ${a.explanation}`);
});

// ---------------------------------------------------------------------------
// gradeGapToNext / nextLabel
// ---------------------------------------------------------------------------

test("target -> safe gap equals competitiveHigh minus average", () => {
  const a = assessProgram(student(83.5, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "target");
  assertClose(a.gradeGapToNext, 6.5, "gradeGapToNext");
  assert.equal(a.nextLabel, "safe");
});

test("reach -> target gap equals competitiveLow minus average", () => {
  const a = assessProgram(student(72, ALL_COURSES), REQ, ALL_PREREQS);
  assert.equal(a.label, "reach");
  assertClose(a.gradeGapToNext, 8, "gradeGapToNext");
  assert.equal(a.nextLabel, "target");
  assert.ok(a.explanation.includes("8%"), `explanation mentions the 8% gap: ${a.explanation}`);
});

// ---------------------------------------------------------------------------
// prereqGroups / groupLabel / LABEL_META
// ---------------------------------------------------------------------------

test("prereqGroups collapses altGroups, keeps solos apart, drops recommended", () => {
  const groups = prereqGroups(ALL_PREREQS);
  assert.equal(groups.length, 2); // ENG4U solo + the math altGroup; ICS4U dropped
  const sizes = groups.map((g) => g.length).sort((x, y) => x - y);
  assert.deepEqual(sizes, [1, 3]);
  const mathGroup = groups.find((g) => g.length === 3);
  assert.ok(mathGroup, "math altGroup exists");
  assert.equal(groupLabel(mathGroup!), "MHF4U or MCV4U or MDM4U");
});

test("LABEL_META ranks order safe < target < reach < unlikely < unknown", () => {
  assert.ok(LABEL_META.safe.rank < LABEL_META.target.rank);
  assert.ok(LABEL_META.target.rank < LABEL_META.reach.rank);
  assert.ok(LABEL_META.reach.rank < LABEL_META.unlikely.rank);
  assert.ok(LABEL_META.unlikely.rank < LABEL_META.unknown.rank);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let passed = 0;
const failures: { name: string; error: unknown }[] = [];

for (const t of tests) {
  try {
    t.fn();
    passed += 1;
    console.log(`  ok    ${t.name}`);
  } catch (error) {
    failures.push({ name: t.name, error });
    console.error(`  FAIL  ${t.name}`);
    console.error(`        ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`\n${passed}/${tests.length} tests passed${failures.length ? `, ${failures.length} failed` : ""}.`);
if (failures.length > 0) process.exit(1);
