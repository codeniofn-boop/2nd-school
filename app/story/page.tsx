import type { Metadata } from "next";
import StoryScene from "@/components/StoryScene";
import "./story.css";

export const metadata: Metadata = {
  title: "AdmitPath — Find your path",
  description: "A scroll-through tour: your average, every Canadian university, every program labeled.",
};

export default function StoryPage() {
  return <StoryScene />;
}
