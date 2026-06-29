import { formatWorkOrderStatusLabel, type WorkOrderStatus } from "../lib/work-order-utils";

type WorkOrderStatusBadgeProps = {
  readonly status: WorkOrderStatus;
};

export function WorkOrderStatusBadge({ status }: WorkOrderStatusBadgeProps) {
  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        {formatWorkOrderStatusLabel(status)}
      </span>
    );
  }

  if (status === "READY") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
        {formatWorkOrderStatusLabel(status)}
      </span>
    );
  }

  if (status === "ASSIGNED") {
    return (
      <span className="inline-flex items-center rounded-md border border-sky-200/80 bg-sky-50/80 px-2 py-0.5 text-xs font-medium text-sky-800">
        {formatWorkOrderStatusLabel(status)}
      </span>
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center rounded-md border border-violet-200/80 bg-violet-50/80 px-2 py-0.5 text-xs font-medium text-violet-800">
        {formatWorkOrderStatusLabel(status)}
      </span>
    );
  }

  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50/80 px-2 py-0.5 text-xs font-medium text-emerald-800">
        {formatWorkOrderStatusLabel(status)}
      </span>
    );
  }

  if (status === "INVOICED") {
    return (
      <span className="inline-flex items-center rounded-md border border-indigo-200/80 bg-indigo-50/80 px-2 py-0.5 text-xs font-medium text-indigo-800">
        {formatWorkOrderStatusLabel(status)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-0.5 text-xs font-medium text-amber-800">
      {formatWorkOrderStatusLabel(status)}
    </span>
  );
}
