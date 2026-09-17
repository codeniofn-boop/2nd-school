// Server-side queries + serialization into the DTO shapes clients receive.
import { prisma } from "./db";
import type { CategorySummaryDTO, ProgramDTO } from "./types";

const parseAliases = (raw: string): string[] => {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
};

export async function getCategorySummaries(): Promise<CategorySummaryDTO[]> {
  const categories = await prisma.programCategory.findMany({
    orderBy: { name: "asc" },
    include: {
      programs: {
        select: { name: true, institutionId: true, institution: { select: { shortName: true, name: true } } },
      },
    },
  });
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    aliases: parseAliases(c.aliases),
    programCount: c.programs.length,
    institutionCount: new Set(c.programs.map((p) => p.institutionId)).size,
    programNames: [
      ...new Set(c.programs.flatMap((p) => [p.name, p.institution.shortName ?? p.institution.name])),
    ],
  }));
}

export interface CategoryDetail {
  slug: string;
  name: string;
  description: string | null;
  programs: ProgramDTO[];
  categoryTips: ProgramDTO["tips"];
}

// Shape returned by the program queries below (relations included, ordered).
type ProgramWithRelations = Awaited<ReturnType<typeof queryPrograms>>[number];

function queryPrograms(where?: { categoryId?: string }) {
  return prisma.program.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      institution: true,
      admissionRequirements: { orderBy: { year: "desc" as const } },
      prerequisites: true,
      supplementaryRequirements: true,
      improvementTips: { orderBy: { sortOrder: "asc" as const } },
    },
  });
}

function serializeProgram(p: ProgramWithRelations): ProgramDTO {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    degreeType: p.degreeType,
    campus: p.campus,
    url: p.url,
    notes: p.notes,
    institution: {
      slug: p.institution.slug,
      name: p.institution.name,
      shortName: p.institution.shortName,
      type: p.institution.type,
      city: p.institution.city,
      province: p.institution.province,
      applicationSystem: p.institution.applicationSystem,
      website: p.institution.website,
    },
    requirement: p.admissionRequirements[0]
      ? {
          year: p.admissionRequirements[0].year,
          minAverage: p.admissionRequirements[0].minAverage,
          competitiveLow: p.admissionRequirements[0].competitiveLow,
          competitiveHigh: p.admissionRequirements[0].competitiveHigh,
          sourceUrl: p.admissionRequirements[0].sourceUrl,
          lastVerified: p.admissionRequirements[0].lastVerified.toISOString(),
          isEstimated: p.admissionRequirements[0].isEstimated,
        }
      : null,
    prerequisites: p.prerequisites.map((pr) => ({
      id: pr.id,
      courseCode: pr.courseCode,
      courseName: pr.courseName,
      minGrade: pr.minGrade,
      isRequired: pr.isRequired,
      altGroup: pr.altGroup,
    })),
    supplementary: p.supplementaryRequirements.map((s) => ({
      kind: s.kind,
      name: s.name,
      description: s.description,
      isWeighted: s.isWeighted,
    })),
    tips: p.improvementTips.map((t) => ({
      kind: t.kind,
      title: t.title,
      detail: t.detail,
      value: t.value,
      sortOrder: t.sortOrder,
    })),
  };
}

/** Every program across every category — the "All programs" browse view. */
export async function getAllProgramsDetail(): Promise<CategoryDetail> {
  const programs = await queryPrograms();
  return {
    slug: "all",
    name: "All programs",
    description: "Every program we track, across all fields and universities.",
    categoryTips: [],
    programs: programs.map(serializeProgram),
  };
}

export async function getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
  const category = await prisma.programCategory.findUnique({
    where: { slug },
    include: { improvementTips: { orderBy: { sortOrder: "asc" } } },
  });
  if (!category) return null;
  const programs = await queryPrograms({ categoryId: category.id });

  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
    categoryTips: category.improvementTips.map((t) => ({
      kind: t.kind,
      title: t.title,
      detail: t.detail,
      value: t.value,
      sortOrder: t.sortOrder,
    })),
    programs: programs.map(serializeProgram),
  };
}

/** Every distinct course that appears as a prerequisite anywhere —
 *  drives the "courses I've taken" checklist. */
export async function getAllCourses(): Promise<{ courseCode: string; courseName: string }[]> {
  const rows = await prisma.prerequisite.findMany({
    select: { courseCode: true, courseName: true },
  });
  const seen = new Map<string, string>();
  for (const r of rows) {
    // Prefer the shortest name for a code (some rows carry "or equivalent" notes)
    const existing = seen.get(r.courseCode);
    if (!existing || r.courseName.length < existing.length) seen.set(r.courseCode, r.courseName);
  }
  return [...seen.entries()]
    .map(([courseCode, courseName]) => ({ courseCode, courseName }))
    .sort((a, b) => a.courseCode.localeCompare(b.courseCode));
}
