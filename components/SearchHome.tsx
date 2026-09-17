"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { CategorySummaryDTO } from "@/lib/types";

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

export default function SearchHome({ categories }: { categories: CategorySummaryDTO[] }) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(
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

  const trimmed = query.trim();
  const results = useMemo(
    () => (trimmed ? fuse.search(trimmed).map((r) => r.item) : categories),
    [fuse, trimmed, categories]
  );

  return (
    <div className="py-8">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Find out where you can get in
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600">
          Search a program you want to study, then add your average once to see a Safe, Target, or
          Reach label at universities across Canada. Try &ldquo;comp sci&rdquo;,
          &ldquo;nursing&rdquo;, or &ldquo;business&rdquo;.
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
          placeholder='Search programs — e.g. "comp sci"'
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <section className="mt-6" aria-live="polite">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {trimmed ? `Matches for "${trimmed}"` : "Browse all programs"}
        </h2>

        {results.length === 0 ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No programs match &ldquo;{trimmed}&rdquo;. Try a broader term like
            &ldquo;engineering&rdquo; or &ldquo;health&rdquo;, or browse the full list by clearing
            the search.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {results.map((c) => (
              <CategoryCard key={c.slug} category={c} />
            ))}
          </div>
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
