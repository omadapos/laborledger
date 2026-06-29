import { NextResponse } from "next/server";

import { API_BASE_URL, formatApiMessage, requireSessionCookie, unauthorizedResponse } from "../../../../../../lib/api-bff";

type RouteContext = {
  params: Promise<{
    invitationId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { invitationId } = await context.params;
  const cookieHeader = await requireSessionCookie();
  if (!cookieHeader) {
    return unauthorizedResponse();
  }

  const apiResponse = await fetch(`${API_BASE_URL}/auth/invitations/${invitationId}/revoke`, {
    method: "POST",
    headers: { cookie: cookieHeader },
    cache: "no-store"
  });

  const responsePayload = (await apiResponse.json().catch(() => ({}))) as { message?: string };

  if (!apiResponse.ok) {
    return NextResponse.json(
      { message: formatApiMessage(responsePayload, "Unable to revoke invitation.") },
      { status: apiResponse.status }
    );
  }

  return NextResponse.json(responsePayload, { status: 200 });
}
