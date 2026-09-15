import { getCategorySummaries } from "@/lib/data";
import SearchHome from "@/components/SearchHome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const categories = await getCategorySummaries();
  return <SearchHome categories={categories} />;
}
