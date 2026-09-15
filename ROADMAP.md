# AdmitPath roadmap

## Recently shipped (v1)

- Fuzzy program search across categories, aliases, and program names (Ontario universities and colleges).
- Safe / Target / Reach / Unlikely labels from a pure, tested rules engine, with plain-language explanations and the grade gap to the next-better label.
- Prerequisite checking with "one of A/B/C" alternative groups and recommended-course handling.
- Data honesty: estimated ranges badged as estimates, source URLs and last-verified dates on every number.
- Structured "improve your chances" tips (deadlines, scholarships, supplementary focus, extracurriculars).
- Idempotent JSON/CSV importer so new programs need no code changes.

## Next, in priority order

### 1. Accounts + saved shortlists

Let students create an account, save their average and course list, and pin programs to a shortlist that persists across visits. This is the highest-leverage feature: everything else (reminders, matching) depends on knowing who the student is and what they care about. Scope: auth (email magic link is enough), a `users` + `shortlist_entries` table pair, and a shortlist page that reuses the existing label components.

### 2. Deadline reminders

Deadline tips already carry machine-readable ISO dates in `value`; surface them as opt-in email reminders ("OUAC equal consideration date is in 2 weeks") for programs on a student's shortlist. Missed deadlines are the most preventable admissions failure, and the data is already structured for it. Scope: a scheduled job that scans upcoming deadline tips against shortlists, plus notification preferences on the account.

### 3. Scholarship matching

Scholarship tips carry a threshold average in `value`; compare it against the student's saved average to show "you currently qualify for..." and "raise your average by X% to qualify for..." across their shortlist. It turns the same improvement framing used for admission labels into a concrete financial incentive. Scope: a matching function in the rules layer (same pattern as `assessProgram`) and a scholarship section on program and shortlist pages.

### 4. More provinces & countries

The schema already supports this: `institutions.province`, `institutions.country`, and free-form `applicationSystem` mean adding BC (EducationPlannerBC) or Alberta (ApplyAlberta) is a data problem, not a schema migration. The main work is product, not plumbing: course-code equivalency (ENG4U vs English Studies 12) so one student profile can be assessed against out-of-province prerequisites. Scope: a course-equivalency mapping table, province filters in the UI, and seed data for one new province as the pilot.

### 5. Counselor dashboard

A read-only view for guidance counselors: their students' shortlists, current labels, missing prerequisites, and upcoming deadlines in one table, so a counselor can spot "no safe school" or "missing a required course for every choice" early. Builds directly on accounts and shortlists. Scope: a counselor role with student-initiated sharing (students invite their counselor), plus one aggregate dashboard page — no write access to student data.
