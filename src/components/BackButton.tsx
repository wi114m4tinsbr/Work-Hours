import { ArrowLeft } from "lucide-react";

/** Shared page navigation; keep the label visible on small screens too. */
export function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-200 px-2.5 text-sm font-semibold text-stone-600 transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-white/10 dark:text-stone-200 dark:hover:bg-white/10"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
