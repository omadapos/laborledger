type EmployeeStatusBadgeProps = {
  readonly archivedAt: string | null;
};

export function EmployeeStatusBadge({ archivedAt }: EmployeeStatusBadgeProps) {
  if (archivedAt) {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        Inactive
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Active
    </span>
  );
}
