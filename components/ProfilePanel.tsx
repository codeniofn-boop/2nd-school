"use client";

import { useState } from "react";
import { useProfile } from "@/lib/profile-context";

export interface CourseOption {
  courseCode: string;
  courseName: string;
}

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

          <p className="mt-4 text-sm font-medium text-slate-700" id="profile-courses-label">
            Courses you&rsquo;ve taken or are taking
          </p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-labelledby="profile-courses-label"
          >
            {courses.map((c) => {
              const isSelected = selected.includes(c.courseCode);
              return (
                <button
                  key={c.courseCode}
                  type="button"
                  aria-pressed={isSelected}
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
            {courses.length === 0 && (
              <p className="text-sm text-slate-500">No prerequisite courses to pick from yet.</p>
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
