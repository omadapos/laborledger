import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

type CreateEmployeeBody = {
  fullName?: string;
  pin?: string;
};

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

function formatApiMessage(payload: { message?: string | string[] }): string {
  if (Array.isArray(payload.message)) {
    return payload.message.join(" ");
  }

  return payload.message ?? "Unable to create employee.";
}

export async function POST(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const body = (await request.json().catch(() => null)) as CreateEmployeeBody | null;
  const fullName = body?.fullName?.trim() ?? "";
  const pin = body?.pin ?? "";

  if (!fullName) {
    return NextResponse.json({ message: "Full name is required." }, { status: 400 });
  }

  if (!/^\d{6}$/u.test(pin)) {
    return NextResponse.json({ message: "Employee PIN must be exactly 6 digits." }, { status: 400 });
  }

  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader.includes("laborledger.sid=")) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const apiResponse = await fetch(`${API_BASE_URL}/company-operations/companies/${companyId}/employees`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader
    },
    body: JSON.stringify({ fullName, pin }),
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as {
    message?: string | string[];
    id?: string;
    fullName?: string;
  };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload) },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(
    {
      employee: {
        id: responsePayload.id,
        fullName: responsePayload.fullName
      }
    },
    { status: 201 }
  );
}
