// The label rules engine. Pure functions, no I/O — unit-testable and shared
// by every surface that needs a label.
//
// Thresholds (documented in README.md):
//   Unlikely: average < published minimum, OR 2+ required prereq groups missing
//   Reach:    minimum <= average < competitive_low, OR exactly 1 group missing
//   Target:   competitive_low <= average < competitive_high, all prereqs met
//   Safe:     average >= competitive_high, all prereqs met
// A missing prerequisite always caps the label (1 missing -> at best Reach).

import type { PrereqDTO, RequirementDTO } from "./types";

export type Label = "safe" | "target" | "reach" | "unlikely" | "unknown";

export interface StudentProfile {
  average: number | null;
  courses: string[]; // completed/in-progress course codes, e.g. ["ENG4U", "MCV4U"]
}

export interface Assessment {
  label: Label;
  explanation: string;
  /** Display text for each unmet required group, e.g. "MHF4U or MCV4U". */
  missingGroups: string[];
  /** Percentage points of average needed to reach the next-better label
   *  (null when prereqs are the blocker or no better label exists). */
  gradeGapToNext: number | null;
  nextLabel: Label | null;
}

/** Required prerequisites collapsed into alternative groups.
 *  A group is satisfied when the student has ANY course in it. */
export function prereqGroups(prereqs: PrereqDTO[]): PrereqDTO[][] {
  const grouped = new Map<string, PrereqDTO[]>();
  for (const p of prereqs) {
    if (!p.isRequired) continue;
    const key = p.altGroup === null ? `solo:${p.id}` : `alt:${p.altGroup}`;
    const list = grouped.get(key) ?? [];
    list.push(p);
    grouped.set(key, list);
  }
  return [...grouped.values()];
}

export function groupLabel(group: PrereqDTO[]): string {
  return group.map((p) => p.courseCode).join(" or ");
}

const fmt = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export function assessProgram(
  profile: StudentProfile,
  requirement: RequirementDTO | null,
  prereqs: PrereqDTO[]
): Assessment {
  const groups = prereqGroups(prereqs);
  const have = new Set(profile.courses.map((c) => c.toUpperCase()));
  const missing = groups.filter((g) => !g.some((p) => have.has(p.courseCode.toUpperCase())));
  const missingLabels = missing.map(groupLabel);

  const base = { missingGroups: missingLabels, gradeGapToNext: null as number | null, nextLabel: null as Label | null };

  if (profile.average === null) {
    return {
      ...base,
      label: "unknown",
      explanation: "Add your average above to see your admission chances.",
    };
  }

  const avg = profile.average;
  const min = requirement?.minAverage ?? null;
  const low = requirement?.competitiveLow ?? null;
  const high = requirement?.competitiveHigh ?? null;

  // Unlikely: 2+ missing prereq groups
  if (missing.length >= 2) {
    return {
      ...base,
      label: "unlikely",
      explanation: `You're missing ${missing.length} required courses: ${missingLabels.join(", ")}.`,
    };
  }

  // Unlikely: below the published minimum
  if (min !== null && avg < min) {
    return {
      ...base,
      label: "unlikely",
      explanation: `Your average is ${fmt(min - avg)}% below the published minimum of ${fmt(min)}%.`,
      gradeGapToNext: min - avg,
      nextLabel: "reach",
    };
  }

  // Reach: exactly one missing prereq group caps the label
  if (missing.length === 1) {
    const belowRange = low !== null && avg < low;
    return {
      ...base,
      label: "reach",
      explanation: belowRange
        ? `You're missing ${missingLabels[0]} and ${fmt(low - avg)}% below the competitive range.`
        : `Your average is competitive, but you're missing ${missingLabels[0]}.`,
      nextLabel: "target",
    };
  }

  // All prereqs met — pure grade bands from here.
  if (high !== null && avg >= high) {
    return {
      ...base,
      label: "safe",
      explanation: `Your ${fmt(avg)}% is at or above the safe zone (${fmt(high)}%+) and you have all prerequisites.`,
    };
  }

  if (low !== null && avg >= low) {
    return {
      ...base,
      label: "target",
      explanation:
        high !== null
          ? `Your ${fmt(avg)}% is within the competitive range (${fmt(low)}–${fmt(high)}%).`
          : `Your ${fmt(avg)}% is at or above the competitive threshold of ${fmt(low)}%.`,
      gradeGapToNext: high !== null ? high - avg : null,
      nextLabel: high !== null ? "safe" : null,
    };
  }

  if (min !== null && avg >= min) {
    return {
      ...base,
      label: "reach",
      explanation:
        low !== null
          ? `You're ${fmt(low - avg)}% below the competitive range for this program.`
          : `You meet the published minimum of ${fmt(min)}%, but no competitive range is available.`,
      gradeGapToNext: low !== null ? low - avg : null,
      nextLabel: low !== null ? "target" : null,
    };
  }

  // No published numbers at all: prereqs met is the only signal we have.
  if (min === null && low === null && high === null) {
    return {
      ...base,
      label: "target",
      explanation: "You meet the listed course requirements; this program has no published cutoff average.",
    };
  }

  // min is null but a competitive range exists and avg < low
  return {
    ...base,
    label: "reach",
    explanation: `You're ${fmt((low ?? 0) - avg)}% below the competitive range for this program.`,
    gradeGapToNext: low !== null ? low - avg : null,
    nextLabel: "target",
  };
}

export const LABEL_META: Record<Label, { name: string; rank: number }> = {
  safe: { name: "Safe", rank: 0 },
  target: { name: "Target", rank: 1 },
  reach: { name: "Reach", rank: 2 },
  unlikely: { name: "Unlikely", rank: 3 },
  unknown: { name: "Add your grades", rank: 4 },
};
