"use client";

import type { PrereqDTO, ProgramDTO, TipDTO } from "@/lib/types";
import { groupLabel, LABEL_META, prereqGroups, type Assessment } from "@/lib/rules";
import { useProfile } from "@/lib/profile-context";
import LabelBadge from "./LabelBadge";

const fmt = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const TIP_KIND_ORDER: Record<string, number> = {
  supplementary_focus: 0,
  deadline: 1,
  scholarship: 2,
  extracurricular: 3,
};

function formatFullDate(iso: string): string | null {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMonthYear(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "MHF4U or MCV4U", with minimum grades shown like "SBI4U (65%+)". */
function groupDisplay(group: PrereqDTO[]): string {
  if (group.every((p) => p.minGrade === null)) return groupLabel(group);
  return group
    .map((p) => (p.minGrade !== null ? `${p.courseCode} (${fmt(p.minGrade)}%+)` : p.courseCode))
    .join(" or ");
}

export default function ProgramCard({
  program,
  assessment,
  categoryTips,
}: {
  program: ProgramDTO;
  assessment: Assessment;
  categoryTips: TipDTO[];
}) {
  const { courses } = useProfile();
  const haveCourses = new Set(courses.map((c) => c.toUpperCase()));
  const colorCode = courses.length > 0;

  const requiredGroups = prereqGroups(program.prerequisites);
  const recommended = program.prerequisites.filter((p) => !p.isRequired);
  const req = program.requirement;

  const meta = [program.degreeType, program.campus, program.institution.city]
    .filter(Boolean)
    .join(" · ");

  // One honest "what would actually change your label" line. A missing
  // course is only promised to improve the label when completing it alone
  // would; when grades are also short, both steps are named together.
  const { label, missingGroups, gradeGapToNext: gap, nextLabel } = assessment;
  const nextName = nextLabel !== null ? LABEL_META[nextLabel].name : null;
  let planLine: string | null = null;
  if (label === "reach" && missingGroups.length === 1) {
    planLine =
      gap !== null && nextName
        ? `To move to ${nextName}: complete ${missingGroups[0]} and raise your average by ${fmt(gap)}%`
        : `Complete ${missingGroups[0]} to move to ${nextName ?? "the next label"}`;
  } else if (label === "unlikely") {
    const gradePart =
      gap !== null && nextName ? `Raise your average by ${fmt(gap)}% to move to ${nextName}` : null;
    const coursePart =
      missingGroups.length > 0
        ? `${gradePart ? "Also complete" : "Complete"} ${missingGroups.join(" and ")} — required for admission`
        : null;
    planLine = [gradePart, coursePart].filter(Boolean).join(". ") || null;
  } else if (gap !== null && nextName) {
    planLine = `Raise your average by ${fmt(gap)}% to move to ${nextName}`;
  }

  const tips = [...program.tips, ...categoryTips].sort(
    (a, b) =>
      (TIP_KIND_ORDER[a.kind] ?? 99) - (TIP_KIND_ORDER[b.kind] ?? 99) || a.sortOrder - b.sortOrder
  );
  const hasImprove = planLine !== null || tips.length > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Top row: label + school */}
      <div className="flex flex-wrap items-center gap-2">
        <LabelBadge label={assessment.label} />
        <span className="text-sm font-medium text-slate-700">
          {program.institution.shortName ?? program.institution.name}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {program.institution.type === "college" ? "College" : "University"}
        </span>
      </div>

      {/* Name + meta */}
      <h3 className="mt-2 font-semibold text-slate-900">{program.name}</h3>
      <p className="mt-0.5 text-sm text-slate-500">{meta}</p>
      <a
        href={program.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex min-h-11 items-center rounded text-sm font-medium text-blue-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Official program page <span aria-hidden="true">&nbsp;↗</span>
      </a>

      {/* Admission numbers */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {req && (req.minAverage !== null || req.competitiveLow !== null || req.competitiveHigh !== null) ? (
          <>
            {req.minAverage !== null && (
              <span className="text-slate-700">
                Minimum: <span className="font-semibold">{fmt(req.minAverage)}%</span>
              </span>
            )}
            {req.competitiveLow !== null && (
              <span className="text-slate-700">
                Competitive:{" "}
                <span className="font-semibold">
                  {req.competitiveHigh !== null
                    ? `${fmt(req.competitiveLow)}–${fmt(req.competitiveHigh)}%`
                    : `${fmt(req.competitiveLow)}%+`}
                </span>
              </span>
            )}
            {req.competitiveHigh !== null && (
              <span className="text-slate-700">
                Safe zone: <span className="font-semibold">{fmt(req.competitiveHigh)}%+</span>
              </span>
            )}
            {req.isEstimated && (req.competitiveLow !== null || req.competitiveHigh !== null) && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-300">
                estimated
              </span>
            )}
          </>
        ) : (
          <span className="text-slate-500">No published cutoff</span>
        )}
      </div>

      {/* Explanation */}
      <p
        className={`mt-2 text-sm ${assessment.label === "unknown" ? "italic text-slate-400" : "text-slate-600"}`}
      >
        {assessment.explanation}
      </p>

      {program.notes && <p className="mt-2 text-xs italic leading-relaxed text-slate-500">{program.notes}</p>}

      {/* Prerequisites */}
      {(requiredGroups.length > 0 || recommended.length > 0) && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Prerequisites
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {requiredGroups.map((group) => {
              const has = group.some((p) => haveCourses.has(p.courseCode.toUpperCase()));
              const cls = !colorCode
                ? "border-slate-300 bg-white text-slate-700"
                : has
                  ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                  : "border-rose-400 bg-white text-rose-700";
              return (
                <span
                  key={group.map((p) => p.id).join("-")}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}
                  title={group.map((p) => p.courseName).join(" or ")}
                >
                  {groupDisplay(group)}
                </span>
              );
            })}
            {recommended.map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-500"
                title={p.courseName}
              >
                {p.minGrade !== null ? `${p.courseCode} (${fmt(p.minGrade)}%+)` : p.courseCode}{" "}
                (recommended)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Supplementary requirements */}
      {program.supplementary.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Also required
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {program.supplementary.map((s) => (
              <span
                key={`${s.kind}-${s.name}`}
                title={s.description ?? undefined}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  s.isWeighted
                    ? "bg-violet-100 text-violet-900 ring-1 ring-inset ring-violet-300"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
              >
                {s.name}
                {s.isWeighted && <span className="text-violet-700"> • weighted</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Improve your chances */}
      {hasImprove && (
        <details className="group mt-3 rounded-lg border border-slate-200 bg-slate-50">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
            Improve your chances
            <span aria-hidden="true" className="text-slate-400 transition-transform group-open:rotate-90">
              ▸
            </span>
          </summary>
          <div className="space-y-3 border-t border-slate-200 px-3 pb-3 pt-2.5">
            {planLine && <p className="text-sm font-medium text-slate-800">{planLine}</p>}
            {tips.map((tip, i) => {
              const deadline = tip.kind === "deadline" && tip.value ? formatFullDate(tip.value) : null;
              const scholarship = tip.kind === "scholarship" && tip.value ? tip.value : null;
              return (
                <div key={`${tip.kind}-${tip.title}-${i}`}>
                  <p className="text-sm font-medium text-slate-800">
                    {tip.title}
                    {deadline && <span className="font-normal text-slate-500"> · {deadline}</span>}
                    {scholarship && (
                      <span className="font-normal text-slate-500">
                        {" "}
                        · automatic at {scholarship}%+
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{tip.detail}</p>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Source footer */}
      {req && (
        <p className="mt-3 text-[11px] text-slate-400">
          <a
            href={req.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center rounded underline underline-offset-2 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Source
          </a>
          {formatMonthYear(req.lastVerified) && <> · Last verified {formatMonthYear(req.lastVerified)}</>}
          {req.isEstimated && <> · Estimated range</>}
        </p>
      )}
    </article>
  );
}
