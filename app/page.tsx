import { getCategorySummaries, getProgramSearchItems } from "@/lib/data";
import SearchHome from "@/components/SearchHome";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, programs] = await Promise.all([getCategorySummaries(), getProgramSearchItems()]);
  return <SearchHome categories={categories} programs={programs} />;
}
