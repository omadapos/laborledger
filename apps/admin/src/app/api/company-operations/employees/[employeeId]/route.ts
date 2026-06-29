import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../lib/api-bff";

type UpdateEmployeeBody = {
  fullName?: string;
};

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { employeeId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/employees/${employeeId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    fullName?: string;
    archivedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to load employee.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json({ employee: responsePayload }, { status: 200 });
}

export async function POST(request: Request, context: RouteContext) {
  const { employeeId } = await context.params;
  const body = (await request.json().catch(() => null)) as UpdateEmployeeBody | null;
  const fullName = body?.fullName?.trim() ?? "";

  if (!fullName) {
    return NextResponse.json({ message: "Full name is required." }, { status: 400 });
  }

  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader.includes("laborledger.sid=")) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/employees/${employeeId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ fullName }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    fullName?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to update employee.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      employee: {
        id: responsePayload.id ?? employeeId,
        fullName: responsePayload.fullName ?? fullName
      }
    },
    { status: 200 }
  );
}
