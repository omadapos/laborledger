import { NextResponse } from "next/server";

import {
  callWorkerCompleteServiceLine,
  fieldJobsNotConfiguredMessage,
  isFieldJobsConfigured
} from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type CompleteJobBody = {
  serviceLineId?: string;
  notes?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireFieldSession();
  if ("response" in auth) {
    return auth.response;
  }

  if (!isFieldJobsConfigured()) {
    return NextResponse.json({ message: fieldJobsNotConfiguredMessage() }, { status: 503 });
  }

  const { jobId } = await context.params;
  const body = (await request.json().catch(() => null)) as CompleteJobBody | null;
  const serviceLineId = body?.serviceLineId?.trim() ?? "";

  if (!serviceLineId) {
    return NextResponse.json({ message: "Service is required." }, { status: 400 });
  }

  if (jobId.trim().length === 0) {
    return NextResponse.json({ message: "Job is required." }, { status: 400 });
  }

  const notes = body?.notes?.trim() || undefined;
  const result = await callWorkerCompleteServiceLine(auth.session, serviceLineId, notes);

  return NextResponse.json(result.payload, { status: result.status });
}
