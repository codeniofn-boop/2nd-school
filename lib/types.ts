// Plain serializable shapes passed from server components to client
// components (Dates are ISO strings).

export interface RequirementDTO {
  year: number;
  minAverage: number | null;
  competitiveLow: number | null;
  competitiveHigh: number | null;
  sourceUrl: string;
  lastVerified: string;
  isEstimated: boolean;
}

export interface PrereqDTO {
  id: string;
  courseCode: string;
  courseName: string;
  minGrade: number | null;
  isRequired: boolean;
  altGroup: number | null;
}

export interface SupplementaryDTO {
  kind: string;
  name: string;
  description: string | null;
  isWeighted: boolean;
}

export interface TipDTO {
  kind: string; // "supplementary_focus" | "extracurricular" | "deadline" | "scholarship"
  title: string;
  detail: string;
  value: string | null;
  sortOrder: number;
}

export interface InstitutionDTO {
  slug: string;
  name: string;
  shortName: string | null;
  type: string;
  city: string;
  province: string;
  applicationSystem: string;
  website: string;
}

export interface ProgramDTO {
  id: string;
  slug: string;
  name: string;
  degreeType: string;
  campus: string | null;
  url: string;
  notes: string | null;
  institution: InstitutionDTO;
  requirement: RequirementDTO | null; // latest intake year
  prerequisites: PrereqDTO[];
  supplementary: SupplementaryDTO[];
  tips: TipDTO[]; // program-level tips
}

export interface ProgramSearchItemDTO {
  slug: string;
  name: string;
  degreeType: string;
  institutionName: string;
  institutionShort: string | null;
  categorySlug: string;
  categoryName: string;
}

export interface CategorySummaryDTO {
  slug: string;
  name: string;
  description: string | null;
  aliases: string[];
  programCount: number;
  institutionCount: number;
  programNames: string[]; // extra fuzzy-search fodder
}

export interface CourseOptionDTO {
  courseCode: string;
  courseName: string;
  subject: string;
  level: "U" | "M";
}
