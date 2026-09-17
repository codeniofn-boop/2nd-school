"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { CategorySummaryDTO, ProgramSearchItemDTO } from "@/lib/types";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function CategoryCard({ category }: { category: CategorySummaryDTO }) {
  return (
    <Link
      href={`/category/${category.slug}`}
      className="block min-h-11 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-blue-300 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <h3 className="font-semibold text-slate-900">{category.name}</h3>
      {category.description && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{category.description}</p>
      )}
      <p className="mt-2 text-xs font-medium text-slate-500">
        {plural(category.programCount, "program")} · {plural(category.institutionCount, "school")}
      </p>
    </Link>
  );
}

function ProgramRow({ program }: { program: ProgramSearchItemDTO }) {
  return (
    <Link
      href={`/category/${program.categorySlug}#${program.slug}`}
      className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors hover:border-blue-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-slate-900">
          {program.name}
        </span>
        <span className="block truncate text-xs text-slate-500">
          {program.institutionShort ?? program.institutionName} · {program.degreeType}
        </span>
      </span>
      <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500">
        {program.categoryName}
      </span>
    </Link>
  );
}

export default function SearchHome({
  categories,
  programs,
}: {
  categories: CategorySummaryDTO[];
  programs: ProgramSearchItemDTO[];
}) {
  const [query, setQuery] = useState("");

  const categoryFuse = useMemo(
    () =>
      new Fuse(categories, {
        keys: [
          { name: "name", weight: 0.6 },
          { name: "aliases", weight: 0.5 },
          { name: "programNames", weight: 0.3 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeScore: true,
      }),
    [categories]
  );

  const programFuse = useMemo(
    () =>
      new Fuse(programs, {
        keys: [
          { name: "name", weight: 0.6 },
          { name: "institutionName", weight: 0.45 },
          { name: "institutionShort", weight: 0.45 },
          { name: "categoryName", weight: 0.15 },
          { name: "degreeType", weight: 0.1 },
        ],
        threshold: 0.35,
        ignoreLocation: true,
        includeScore: true,
      }),
    [programs]
  );

  const trimmed = query.trim();
  const categoryResults = useMemo(
    () => (trimmed ? categoryFuse.search(trimmed).map((r) => r.item) : categories),
    [categoryFuse, trimmed, categories]
  );
  const programResults = useMemo(
    () => (trimmed ? programFuse.search(trimmed).slice(0, 10).map((r) => r.item) : []),
    [programFuse, trimmed]
  );

  const nothingFound = trimmed !== "" && categoryResults.length === 0 && programResults.length === 0;

  return (
    <div className="py-8">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Find out where you can get in
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
          Search any program, university, or field of study, then add your average once to see a
          Safe, Target, or Reach label at universities across Canada. Try &ldquo;comp sci&rdquo;,
          &ldquo;Rotman&rdquo;, or &ldquo;UBC&rdquo;.
        </p>
      </section>

      <div className="mt-6">
        <label htmlFor="program-search" className="sr-only">
          Search programs
        </label>
        <input
          id="program-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search programs — e.g. "nursing", "Rotman", "UBC"'
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <section className="mt-6" aria-live="polite">
        {nothingFound && (
          <p className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Nothing matches &ldquo;{trimmed}&rdquo;. Try a broader term like
            &ldquo;engineering&rdquo; or &ldquo;health&rdquo;, or browse the full list by clearing
            the search.
          </p>
        )}

        {programResults.length > 0 && (
          <>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Programs
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {programResults.map((p) => (
                <ProgramRow key={p.slug} program={p} />
              ))}
            </div>
          </>
        )}

        {categoryResults.length > 0 && (
          <>
            <h2
              className={`text-xs font-semibold uppercase tracking-wide text-slate-500 ${programResults.length > 0 ? "mt-6" : ""}`}
            >
              {trimmed ? "Fields of study" : "Browse all programs"}
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categoryResults.map((c) => (
                <CategoryCard key={c.slug} category={c} />
              ))}
            </div>
          </>
        )}

        <p className="mt-6 text-center">
          <Link
            href="/story"
            className="mr-6 inline-flex min-h-11 items-center rounded text-sm font-semibold text-slate-500 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Take the tour
          </Link>
          <Link
            href="/all"
            className="inline-flex min-h-11 items-center rounded text-sm font-semibold text-blue-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Browse all {categories.reduce((n, c) => n + c.programCount, 0)} programs at every
            university&nbsp;&rarr;
          </Link>
        </p>
      </section>
    </div>
  );
}
