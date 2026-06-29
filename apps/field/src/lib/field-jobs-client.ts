import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";
import type { FieldSessionData } from "@/lib/field-session";
import type { WorkerAssignmentRecord } from "@/lib/worker-utils";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type FieldJobsContextResponse = {
  session: {
    employeeId: string;
    employeeName: string;
    companyName: string;
  };
  jobCreationSupported: true;
  assignments: WorkerAssignmentRecord[];
  recentCompletions: FieldJobCompletionSummary[];
};

export type FieldJobCompletionSummary = {
  serviceCompletionId: string;
  completedAt: string;
  serviceName: string;
  workOrderNumber: string;
  customerName: string;
  locationName: string;
  vehicleVin: string;
  notes: string | null;
};

export type FieldJobOptionsResponse = {
  serviceClients: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string; serviceClientId: string }>;
  serviceCatalogItems: Array<{ id: string; name: string; category: string | null }>;
};

export type FieldWorkerApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  payload: T;
};

function workerCompanyId(): string | null {
  return requireResolvedFieldCompanyId();
}

export function fieldJobsNotConfiguredMessage(): string {
  return fieldCompanyNotConfiguredMessage();
}

export function isFieldJobsConfigured(): boolean {
  return workerCompanyId() !== null;
}

export async function callWorkerLookup(
  session: FieldSessionData
): Promise<FieldWorkerApiResult> {
  const companyId = workerCompanyId();
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldJobsNotConfiguredMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/lookup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId, pin: session.pin }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callWorkerScan(
  session: FieldSessionData,
  input: {
    workOrderId: string;
    workOrderAssignmentId?: string;
    enteredVin: string;
    idempotencyKey?: string;
  }
): Promise<FieldWorkerApiResult> {
  const companyId = workerCompanyId();
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldJobsNotConfiguredMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyId,
      pin: session.pin,
      workOrderId: input.workOrderId,
      workOrderAssignmentId: input.workOrderAssignmentId,
      enteredVin: input.enteredVin,
      idempotencyKey: input.idempotencyKey
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callWorkerCompleteServiceLine(
  session: FieldSessionData,
  workOrderServiceLineId: string,
  notes?: string
): Promise<FieldWorkerApiResult> {
  const companyId = workerCompanyId();
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldJobsNotConfiguredMessage() }
    };
  }

  const apiResponse = await fetch(
    `${API_BASE_URL}/worker/service-lines/${workOrderServiceLineId}/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId,
        pin: session.pin,
        notes
      }),
      cache: "no-store"
    }
  );

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callWorkerJobOptions(
  session: FieldSessionData
): Promise<FieldWorkerApiResult> {
  const companyId = workerCompanyId();
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldJobsNotConfiguredMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/jobs/options`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId, pin: session.pin }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callWorkerCreateJob(
  session: FieldSessionData,
  input: {
    enteredVin: string;
    serviceClientId: string;
    locationId: string;
    serviceCatalogItemId: string;
    notes?: string;
  }
): Promise<FieldWorkerApiResult> {
  const companyId = workerCompanyId();
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldJobsNotConfiguredMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/jobs/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      companyId,
      pin: session.pin,
      ...input
    }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callWorkerRecentCompletions(
  session: FieldSessionData,
  limit = 10
): Promise<FieldWorkerApiResult> {
  const companyId = workerCompanyId();
  if (!companyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldJobsNotConfiguredMessage() }
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/worker/jobs/recent-completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId, pin: session.pin, limit }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export function mapFieldJobsContext(
  session: FieldSessionData,
  lookupPayload: Record<string, unknown>,
  recentPayload: Record<string, unknown>
): FieldJobsContextResponse {
  const employee = lookupPayload.employee as { id?: string; fullName?: string } | undefined;
  const company = lookupPayload.company as { name?: string } | undefined;
  const assignments = (lookupPayload.assignments ?? []) as WorkerAssignmentRecord[];
  const recentCompletions = (recentPayload.completions ?? []) as FieldJobCompletionSummary[];

  return {
    session: {
      employeeId: employee?.id ?? session.employeeId,
      employeeName: employee?.fullName ?? session.employeeName,
      companyName: company?.name ?? session.companyName
    },
    jobCreationSupported: true,
    assignments,
    recentCompletions
  };
}
