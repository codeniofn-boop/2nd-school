"use client";

import { useMemo, useState } from "react";
import { useProfile } from "@/lib/profile-context";
import { SUBJECT_ORDER } from "@/lib/courses";
import type { CourseOptionDTO } from "@/lib/types";

export type CourseOption = CourseOptionDTO;

const clampAverage = (n: number) => Math.min(100, Math.max(50, Math.round(n * 10) / 10));

const fmt = (n: number) => {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

// The panel remounts (via key) when the persisted profile finishes loading,
// so lazy state initializers can read the loaded profile directly: it starts
// collapsed for a student who already filled in their grades, open otherwise.
export default function ProfilePanel({ courses }: { courses: CourseOption[] }) {
  const { ready } = useProfile();
  return <ProfilePanelInner key={ready ? "ready" : "loading"} courses={courses} />;
}

function ProfilePanelInner({ courses }: { courses: CourseOption[] }) {
  const { average, courses: selected, setAverage, toggleCourse, clear } = useProfile();

  const [open, setOpen] = useState(() => average === null && selected.length === 0);
  // null = untouched: the input mirrors the stored average.
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (average !== null ? String(average) : "");

  const handleAverageChange = (value: string) => {
    setDraft(value);
    if (value.trim() === "") {
      setAverage(null);
      return;
    }
    const n = Number(value);
    if (Number.isFinite(n) && n >= 50 && n <= 100) setAverage(Math.round(n * 10) / 10);
  };

  const handleAverageBlur = () => {
    if (text.trim() === "") {
      setAverage(null);
      setDraft(null);
      return;
    }
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setAverage(null);
      setDraft(null);
      return;
    }
    setAverage(clampAverage(n));
    setDraft(null); // mirror the stored (clamped) value again
  };

  const handleClear = () => {
    clear();
    setDraft(null);
  };

  const [filter, setFilter] = useState("");
  const selectedSet = useMemo(
    () => new Set(selected.map((c) => c.toUpperCase())),
    [selected]
  );

  // Group the catalogue by subject, in curriculum order, applying the filter.
  // Selected courses always stay visible so nothing silently disappears.
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const match = (c: CourseOption) =>
      q === "" ||
      selectedSet.has(c.courseCode.toUpperCase()) ||
      c.courseCode.toLowerCase().includes(q) ||
      c.courseName.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q);

    const bySubject = new Map<string, CourseOption[]>();
    for (const c of courses) {
      if (!match(c)) continue;
      const list = bySubject.get(c.subject) ?? [];
      list.push(c);
      bySubject.set(c.subject, list);
    }
    const order = [...SUBJECT_ORDER] as string[];
    return [...bySubject.entries()].sort(
      (a, b) =>
        (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) -
        (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0]))
    );
  }, [courses, filter, selectedSet]);

  const summary =
    average !== null
      ? `Your average: ${fmt(average)}% · ${selected.length} course${selected.length === 1 ? "" : "s"}`
      : null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="profile-panel-body"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <span>
          <span className="block font-semibold text-slate-900">Your grades</span>
          {summary && <span className="mt-0.5 block text-xs text-slate-500">{summary}</span>}
        </span>
        <span aria-hidden="true" className="text-slate-400">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div id="profile-panel-body" className="border-t border-slate-100 px-4 pb-4 pt-3">
          <label htmlFor="profile-average" className="block text-sm font-medium text-slate-700">
            Current top-6 average (%)
          </label>
          <input
            id="profile-average"
            type="number"
            inputMode="decimal"
            min={50}
            max={100}
            step={0.1}
            value={text}
            onChange={(e) => handleAverageChange(e.target.value)}
            onBlur={handleAverageBlur}
            placeholder="e.g. 88"
            className="mt-1 h-11 w-32 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-slate-700" id="profile-courses-label">
              Courses you&rsquo;ve taken or are taking
            </p>
            <p className="text-xs text-slate-500">
              {selected.length > 0 ? `${selected.length} selected` : "Grade 12 U/M courses"}
            </p>
          </div>

          <label htmlFor="course-filter" className="sr-only">
            Filter courses
          </label>
          <input
            id="course-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by code or name — e.g. &quot;bio&quot;, &quot;SCH&quot;"
            autoComplete="off"
            className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          <div className="mt-3 space-y-4" role="group" aria-labelledby="profile-courses-label">
            {groups.map(([subject, list]) => (
              <div key={subject}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {subject}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {list.map((c) => {
                    const isSelected = selectedSet.has(c.courseCode.toUpperCase());
                    return (
                      <button
                        key={c.courseCode}
                        type="button"
                        aria-pressed={isSelected}
                        title={c.courseName}
                        onClick={() => toggleCourse(c.courseCode)}
                        className={`min-h-11 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                          isSelected
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                        }`}
                      >
                        <span className="font-semibold">{c.courseCode}</span>{" "}
                        <span className={isSelected ? "text-slate-200" : "text-slate-500"}>
                          {c.courseName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-sm text-slate-500">
                No courses match &ldquo;{filter.trim()}&rdquo;.
              </p>
            )}
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleClear}
              className="min-h-11 rounded px-1 text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
