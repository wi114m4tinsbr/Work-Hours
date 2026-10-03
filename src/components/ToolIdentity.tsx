import { BackButton } from "./BackButton";

/** Common tool identity for current and future workspace tools. */
export function ToolIdentity({ title, language, backLabel, onBack }: {
  title: string;
  language: "pt" | "en" | "es";
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 min-w-0">
      <BackButton label={backLabel} onClick={onBack} />
      <span aria-hidden="true" className="h-6 w-px shrink-0 bg-gray-200 dark:bg-white/10" />
      <div className="min-w-0">
        <p className="text-[10px] leading-3 uppercase tracking-[0.16em] font-black text-gray-400">
          {language === "en" ? "Tool" : language === "es" ? "Herramienta" : "Ferramenta"}
        </p>
        <h1 className="text-sm sm:text-base leading-5 font-black text-gray-900 dark:text-white whitespace-nowrap">{title}</h1>
      </div>
    </div>
  );
}
