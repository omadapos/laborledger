type StatusCardProps = {
  readonly title: string;
  readonly description: string;
  readonly tone?: "neutral" | "success" | "warning";
};

export function StatusCard({ title, description, tone = "neutral" }: StatusCardProps) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-white text-slate-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClass}`}>
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}
