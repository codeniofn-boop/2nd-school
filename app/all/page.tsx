import { getAllProgramsDetail, getAllCourses } from "@/lib/data";
import CategoryResults from "@/components/CategoryResults";

export const dynamic = "force-dynamic";

export default async function AllProgramsPage() {
  const [detail, courses] = await Promise.all([getAllProgramsDetail(), getAllCourses()]);
  return <CategoryResults detail={detail} courses={courses} />;
}
