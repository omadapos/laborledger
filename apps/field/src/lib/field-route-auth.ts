import { NextResponse } from "next/server";

import { readFieldSession, type FieldSessionData } from "@/lib/field-session";

export async function requireFieldSession(): Promise<
  { session: FieldSessionData } | { response: NextResponse }
> {
  const session = await readFieldSession();
  if (!session) {
    return {
      response: NextResponse.json({ message: "Sign in required." }, { status: 401 })
    };
  }
  return { session };
}
