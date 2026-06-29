"use client";

import { WorkOrderDetailContent } from "./work-order-detail-content";
import type { EmployeeRecord } from "../lib/employee-utils";
import type { WorkOrderListRecord } from "../lib/work-order-utils";

type WorkOrderDetailDrawerProps = {
  readonly workOrder: WorkOrderListRecord | null;
  readonly companyName: string;
  readonly employees: EmployeeRecord[];
  readonly onClose: () => void;
};

export function WorkOrderDetailDrawer({
  workOrder,
  companyName,
  employees,
  onClose
}: WorkOrderDetailDrawerProps) {
  if (!workOrder) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close work order detail"
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl shadow-slate-300/30"
        role="dialog"
        aria-labelledby="work-order-detail-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="work-order-detail-title" className="truncate text-base font-semibold text-slate-900">
              {workOrder.workOrderNumber}
            </h2>
            <p className="text-xs text-slate-500">{companyName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <WorkOrderDetailContent
            workOrder={workOrder}
            companyName={companyName}
            employees={employees}
            canManageAssignments
            onChanged={onClose}
          />
        </div>
      </aside>
    </>
  );
}
