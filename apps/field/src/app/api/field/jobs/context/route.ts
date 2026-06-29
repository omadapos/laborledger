import { NextResponse } from "next/server";

import {
  callWorkerLookup,
  callWorkerRecentCompletions,
  fieldJobsNotConfiguredMessage,
  isFieldJobsConfigured,
  mapFieldJobsContext
} from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

export async function GET() {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured()) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const [lookup, recent] = await Promise.all([
    callWorkerLookup(auth.session),
    callWorkerRecentCompletions(auth.session)
  ]);

  if (!lookup.ok) {
    return NextResponse.json(lookup.payload, { status: lookup.status });
  }

  if (!recent.ok) {
    return NextResponse.json(recent.payload, { status: recent.status });
  }

  return NextResponse.json(mapFieldJobsContext(auth.session, lookup.payload, recent.payload));
}
