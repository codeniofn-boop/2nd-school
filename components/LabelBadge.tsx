import { LABEL_META, type Label } from "@/lib/rules";

const STYLES: Record<Label, string> = {
  safe: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  target: "bg-blue-100 text-blue-800 ring-blue-300",
  reach: "bg-amber-100 text-amber-800 ring-amber-300",
  unlikely: "bg-rose-100 text-rose-800 ring-rose-300",
  unknown: "bg-slate-100 text-slate-500 ring-slate-300",
};

export default function LabelBadge({ label }: { label: Label }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STYLES[label]}`}
    >
      {LABEL_META[label].name}
    </span>
  );
}
