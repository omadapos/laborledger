type ShiftStatusBadgeProps = {
  readonly status: string;
};

export function ShiftStatusBadge({ status }: ShiftStatusBadgeProps) {
  if (status === "SCHEDULED") {
    return (
      <span className="inline-flex items-center rounded-md border border-brand-200/80 bg-brand-50/80 px-2 py-0.5 text-xs font-medium text-brand-800">
        Scheduled
      </span>
    );
  }

  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        Cancelled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
      {status}
    </span>
  );
}
