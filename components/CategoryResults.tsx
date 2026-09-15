"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CategoryDetail } from "@/lib/data";
import type { RequirementDTO } from "@/lib/types";
import { assessProgram, LABEL_META, type Label } from "@/lib/rules";
import { useProfile } from "@/lib/profile-context";
import ProfilePanel, { type CourseOption } from "./ProfilePanel";
import ProgramCard from "./ProgramCard";

const LABEL_TEXT_COLOR: Record<Label, string> = {
  safe: "text-emerald-700",
  target: "text-blue-700",
  reach: "text-amber-700",
  unlikely: "text-rose-700",
  unknown: "text-slate-500",
};

/** Sort key within a label rank: competitiveHigh descending, programs with no
 *  published requirement last. */
function requirementSortKey(req: RequirementDTO | null): number {
  if (!req) return Number.NEGATIVE_INFINITY;
  return req.competitiveHigh ?? req.competitiveLow ?? req.minAverage ?? -1;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function CategoryResults({
  detail,
  courses,
}: {
  detail: CategoryDetail;
  courses: CourseOption[];
}) {
  const { average, courses: myCourses } = useProfile();

  const assessed = useMemo(() => {
    const items = detail.programs.map((program) => ({
      program,
      assessment: assessProgram({ average, courses: myCourses }, program.requirement, program.prerequisites),
    }));
    items.sort((a, b) => {
      const rankDiff = LABEL_META[a.assessment.label].rank - LABEL_META[b.assessment.label].rank;
      if (rankDiff !== 0) return rankDiff;
      return requirementSortKey(b.program.requirement) - requirementSortKey(a.program.requirement);
    });
    return items;
  }, [detail.programs, average, myCourses]);

  const labelCounts = useMemo(() => {
    const counts = new Map<Label, number>();
    for (const { assessment } of assessed) {
      counts.set(assessment.label, (counts.get(assessment.label) ?? 0) + 1);
    }
    return counts;
  }, [assessed]);

  const schoolCount = new Set(detail.programs.map((p) => p.institution.slug)).size;
  const hasEstimated = detail.programs.some((p) => p.requirement?.isEstimated);

  const summaryOrder: Label[] = ["safe", "target", "reach", "unlikely"];

  return (
    <div className="py-6">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded text-sm font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span aria-hidden="true">←&nbsp;</span>Back to search
      </Link>

      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{detail.name}</h1>
      {detail.description && (
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{detail.description}</p>
      )}
      <p className="mt-1 text-sm font-medium text-slate-500">
        {plural(detail.programs.length, "program")} · {plural(schoolCount, "school")}
      </p>

      <div className="mt-4">
        <ProfilePanel courses={courses} />
      </div>

      {average !== null && (
        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Results summary">
          {summaryOrder
            .filter((label) => (labelCounts.get(label) ?? 0) > 0)
            .map((label) => (
              <span
                key={label}
                className={`rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold ${LABEL_TEXT_COLOR[label]}`}
              >
                {labelCounts.get(label)} {LABEL_META[label].name}
              </span>
            ))}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {assessed.map(({ program, assessment }) => (
          <ProgramCard
            key={program.id}
            program={program}
            assessment={assessment}
            categoryTips={detail.categoryTips}
          />
        ))}
        {assessed.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No programs have been added to this category yet.
          </p>
        )}
      </div>

      {hasEstimated && (
        <p className="mt-6 text-xs leading-relaxed text-slate-400">
          Ranges marked &ldquo;estimated&rdquo; are AdmitPath estimates based on historical
          admission data — not official published cutoffs.
        </p>
      )}
    </div>
  );
}
