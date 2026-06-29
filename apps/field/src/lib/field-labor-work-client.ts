import {
  fieldCompanyNotConfiguredMessage,
  requireResolvedFieldCompanyId
} from "@/lib/field-company-resolver";
import type { FieldSessionData } from "@/lib/field-session";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export type FieldLaborWorkActiveResponse = {
  clockedIn: boolean;
  assignment: FieldLaborWorkAssignment | null;
  message: string | null;
};

export type FieldLaborWorkAssignment = {
  id: string;
  employeeName: string;
  clientName: string;
  address: string;
  serviceName: string;
  status: string;
  progressPercent: number;
  progressStatus: string | null;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  blockedReason: string | null;
  referencePrepStartedAt: string | null;
  referencePrepCompletedAt: string | null;
  referenceWashStartedAt: string | null;
  referenceWashCompletedAt: string | null;
  referenceServiceMinutes: number | null;
  referencePrepMinutes: number | null;
  referenceWashMinutes: number | null;
  billingSourceReminder: string;
};

export type FieldLaborWorkOptionsResponse = {
  employee: { id: string; fullName: string };
  company: { id: string; name: string };
  serviceClients: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string; serviceClientId: string }>;
  serviceCatalogItems: Array<{ id: string; name: string; category: string | null }>;
  vehicles: Array<{ id: string; vin: string; serviceClientId: string; locationId: string }>;
};

export type FieldLaborWorkApiResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  payload: T;
};

function companyId(): string | null {
  return requireResolvedFieldCompanyId();
}

export function fieldLaborWorkNotConfiguredMessage(): string {
  return fieldCompanyNotConfiguredMessage();
}

export function isFieldLaborWorkConfigured(): boolean {
  return companyId() !== null;
}

async function callFieldLaborWork<T>(
  session: FieldSessionData,
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, unknown>
): Promise<FieldLaborWorkApiResult<T>> {
  // Field BFF routes expose GET to the PWA. Server-to-server calls to the Nest API stay POST
  // so employee PIN auth stays in the JSON body instead of query strings.
  const resolvedCompanyId = companyId();
  if (!resolvedCompanyId) {
    return {
      ok: false,
      status: 503,
      payload: { message: fieldLaborWorkNotConfiguredMessage() } as T
    };
  }

  const apiResponse = await fetch(`${API_BASE_URL}/field/labor-work${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ companyId: resolvedCompanyId, pin: session.pin, ...body }),
    cache: "no-store"
  });

  const payload = (await apiResponse.json().catch(() => ({}))) as T;
  return { ok: apiResponse.ok, status: apiResponse.status, payload };
}

export async function callFieldLaborWorkActive(session: FieldSessionData) {
  return callFieldLaborWork<FieldLaborWorkActiveResponse>(session, "/active", "POST");
}

export async function callFieldLaborWorkOptions(session: FieldSessionData) {
  return callFieldLaborWork<FieldLaborWorkOptionsResponse>(session, "/available-options", "POST");
}

export async function callFieldLaborWorkStart(
  session: FieldSessionData,
  input: {
    serviceClientId: string;
    locationId: string;
    serviceCatalogItemId: string;
    vehicleId?: string;
    vin?: string;
    notes?: string;
  }
) {
  return callFieldLaborWork<{ assignment: FieldLaborWorkAssignment; message: string }>(
    session,
    "/start",
    "POST",
    input
  );
}

export async function callFieldLaborWorkProgress(
  session: FieldSessionData,
  assignmentId: string,
  input: {
    progressPercent?: number;
    referenceAction?: "prep_start" | "prep_complete" | "wash_start" | "wash_complete";
    notes?: string;
  }
) {
  return callFieldLaborWork<{ assignment: FieldLaborWorkAssignment }>(
    session,
    `/${assignmentId}/progress`,
    "PATCH",
    input
  );
}

export async function callFieldLaborWorkComplete(session: FieldSessionData, assignmentId: string) {
  return callFieldLaborWork<{ assignment: FieldLaborWorkAssignment }>(
    session,
    `/${assignmentId}/complete`,
    "POST"
  );
}

export async function callFieldLaborWorkBlock(
  session: FieldSessionData,
  assignmentId: string,
  blockedReason: string
) {
  return callFieldLaborWork<{ assignment: FieldLaborWorkAssignment }>(
    session,
    `/${assignmentId}/block`,
    "POST",
    { blockedReason }
  );
}

export async function callFieldLaborWorkCancel(session: FieldSessionData, assignmentId: string) {
  return callFieldLaborWork<{ assignment: FieldLaborWorkAssignment }>(
    session,
    `/${assignmentId}/cancel`,
    "POST"
  );
}
