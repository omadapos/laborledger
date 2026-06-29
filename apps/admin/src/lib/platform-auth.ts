import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { fetchAuthMe, WorkspaceApiError } from "./workspace-auth";
import { isPlatformSuperadmin } from "./platform-customer-utils";

export async function loadPlatformSuperadminContext() {
  const cookieHeader = (await cookies()).toString();

  if (!cookieHeader.includes("laborledger.sid=")) {
    redirect("/login");
  }

  let session;

  try {
    session = await fetchAuthMe(cookieHeader);
  } catch (error) {
    if (error instanceof WorkspaceApiError && error.status === 401) {
      redirect("/login");
    }

    throw error;
  }

  if (!isPlatformSuperadmin(session.user.globalRole)) {
    redirect("/employees");
  }

  return {
    cookieHeader,
    session
  };
}
