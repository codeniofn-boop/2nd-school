import { notFound } from "next/navigation";
import { getAllCourses, getCategoryDetail } from "@/lib/data";
import CategoryResults from "@/components/CategoryResults";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [detail, courses] = await Promise.all([getCategoryDetail(slug), getAllCourses()]);
  if (!detail) notFound();
  return <CategoryResults detail={detail} courses={courses} />;
}
