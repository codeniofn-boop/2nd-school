// Ontario Grade 12 courses at the two destinations universities accept:
// "U" (University preparation) and "M" (University/College preparation).
// College-only (C), workplace (E), and open (O) courses are deliberately
// excluded — they do not satisfy university admission requirements.
//
// This is the vocabulary students pick from when listing what they have
// taken. Programs may reference codes outside this list (imported data
// wins); anything unrecognized is surfaced under "Other courses".

export type CourseLevel = "U" | "M";

export interface CatalogueCourse {
  courseCode: string;
  courseName: string;
  subject: string;
  level: CourseLevel;
}

/** Display order for the grouped course picker. */
export const SUBJECT_ORDER = [
  "English",
  "Mathematics",
  "Science",
  "Canadian and World Studies",
  "Social Sciences and Humanities",
  "Business Studies",
  "Computer Studies",
  "French and Languages",
  "The Arts",
  "Health and Physical Education",
  "Technological Education",
  "Interdisciplinary Studies",
  "Other courses",
] as const;

export const ONTARIO_GRADE_12_COURSES: CatalogueCourse[] = [
  // --- English -------------------------------------------------------------
  { courseCode: "ENG4U", courseName: "English", subject: "English", level: "U" },
  { courseCode: "EWC4U", courseName: "The Writer's Craft", subject: "English", level: "U" },
  { courseCode: "ETS4U", courseName: "Studies in Literature", subject: "English", level: "U" },

  // --- Mathematics ---------------------------------------------------------
  { courseCode: "MHF4U", courseName: "Advanced Functions", subject: "Mathematics", level: "U" },
  { courseCode: "MCV4U", courseName: "Calculus and Vectors", subject: "Mathematics", level: "U" },
  { courseCode: "MDM4U", courseName: "Mathematics of Data Management", subject: "Mathematics", level: "U" },

  // --- Science -------------------------------------------------------------
  { courseCode: "SBI4U", courseName: "Biology", subject: "Science", level: "U" },
  { courseCode: "SCH4U", courseName: "Chemistry", subject: "Science", level: "U" },
  { courseCode: "SPH4U", courseName: "Physics", subject: "Science", level: "U" },
  { courseCode: "SES4U", courseName: "Earth and Space Science", subject: "Science", level: "U" },
  { courseCode: "SNC4M", courseName: "Science", subject: "Science", level: "M" },

  // --- Canadian and World Studies -----------------------------------------
  { courseCode: "CHY4U", courseName: "World History since the Fifteenth Century", subject: "Canadian and World Studies", level: "U" },
  { courseCode: "CHI4U", courseName: "Canada: History, Identity and Culture", subject: "Canadian and World Studies", level: "U" },
  { courseCode: "CGW4U", courseName: "World Issues: A Geographic Analysis", subject: "Canadian and World Studies", level: "U" },
  { courseCode: "CLN4U", courseName: "Canadian and International Law", subject: "Canadian and World Studies", level: "U" },
  { courseCode: "CIA4U", courseName: "Analysing Current Economic Issues", subject: "Canadian and World Studies", level: "U" },
  { courseCode: "CPW4U", courseName: "Canadian and International Politics", subject: "Canadian and World Studies", level: "U" },
  { courseCode: "CGU4M", courseName: "World Geography: Urban Patterns and Population Issues", subject: "Canadian and World Studies", level: "M" },
  { courseCode: "CGR4M", courseName: "The Environment and Resource Management", subject: "Canadian and World Studies", level: "M" },
  { courseCode: "CGO4M", courseName: "Spatial Technologies in Action", subject: "Canadian and World Studies", level: "M" },

  // --- Social Sciences and Humanities --------------------------------------
  { courseCode: "HSB4U", courseName: "Challenge and Change in Society", subject: "Social Sciences and Humanities", level: "U" },
  { courseCode: "HHS4U", courseName: "Families in Canada", subject: "Social Sciences and Humanities", level: "U" },
  { courseCode: "HZT4U", courseName: "Philosophy: Questions and Theories", subject: "Social Sciences and Humanities", level: "U" },
  { courseCode: "HFA4U", courseName: "Nutrition and Health", subject: "Social Sciences and Humanities", level: "U" },
  { courseCode: "HHG4M", courseName: "Human Development Throughout the Lifespan", subject: "Social Sciences and Humanities", level: "M" },
  { courseCode: "HSE4M", courseName: "Equity and Social Justice: From Theory to Practice", subject: "Social Sciences and Humanities", level: "M" },

  // --- Business Studies ----------------------------------------------------
  { courseCode: "BAT4M", courseName: "Financial Accounting Principles", subject: "Business Studies", level: "M" },
  { courseCode: "BBB4M", courseName: "International Business Fundamentals", subject: "Business Studies", level: "M" },
  { courseCode: "BOH4M", courseName: "Business Leadership: Management Fundamentals", subject: "Business Studies", level: "M" },

  // --- Computer Studies ----------------------------------------------------
  { courseCode: "ICS4U", courseName: "Computer Science", subject: "Computer Studies", level: "U" },

  // --- French and Languages ------------------------------------------------
  { courseCode: "FSF4U", courseName: "Core French", subject: "French and Languages", level: "U" },
  { courseCode: "FIF4U", courseName: "Extended French", subject: "French and Languages", level: "U" },
  { courseCode: "FEF4U", courseName: "French Immersion", subject: "French and Languages", level: "U" },
  { courseCode: "LVV4U", courseName: "Classical Languages: Latin", subject: "French and Languages", level: "U" },

  // --- The Arts ------------------------------------------------------------
  { courseCode: "AVI4M", courseName: "Visual Arts", subject: "The Arts", level: "M" },
  { courseCode: "AWQ4M", courseName: "Visual Arts: Photography", subject: "The Arts", level: "M" },
  { courseCode: "ASM4M", courseName: "Media Arts", subject: "The Arts", level: "M" },
  { courseCode: "AMU4M", courseName: "Music", subject: "The Arts", level: "M" },
  { courseCode: "ADA4M", courseName: "Dramatic Arts", subject: "The Arts", level: "M" },
  { courseCode: "ATC4M", courseName: "Dance", subject: "The Arts", level: "M" },

  // --- Health and Physical Education ---------------------------------------
  { courseCode: "PSK4U", courseName: "Introductory Kinesiology", subject: "Health and Physical Education", level: "U" },
  { courseCode: "PLF4M", courseName: "Recreation and Healthy Active Living Leadership", subject: "Health and Physical Education", level: "M" },

  // --- Technological Education ---------------------------------------------
  { courseCode: "TEJ4M", courseName: "Computer Engineering Technology", subject: "Technological Education", level: "M" },
  { courseCode: "TGJ4M", courseName: "Communications Technology", subject: "Technological Education", level: "M" },
  { courseCode: "TDJ4M", courseName: "Technological Design", subject: "Technological Education", level: "M" },
  { courseCode: "TPJ4M", courseName: "Health Care", subject: "Technological Education", level: "M" },

  // --- Interdisciplinary ---------------------------------------------------
  { courseCode: "IDC4U", courseName: "Interdisciplinary Studies", subject: "Interdisciplinary Studies", level: "U" },
];

export const COURSE_BY_CODE = new Map(
  ONTARIO_GRADE_12_COURSES.map((c) => [c.courseCode.toUpperCase(), c])
);
