import type { RateSourceLabel } from "../lib/rate-utils";

type RateSourceBadgeProps = {
  readonly source: RateSourceLabel;
};

export function RateSourceBadge({ source }: RateSourceBadgeProps) {
  if (source === "Override") {
    return (
      <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800">
        Override
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
      Default
    </span>
  );
}
