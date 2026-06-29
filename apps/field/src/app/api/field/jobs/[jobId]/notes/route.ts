import { NextResponse } from "next/server";

import { fieldJobsNotConfiguredMessage, isFieldJobsConfigured } from "@/lib/field-jobs-client";
import { requireFieldSession } from "@/lib/field-route-auth";

type NotesBody = {
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
  const body = (await request.json().catch(() => null)) as NotesBody | null;
  const notes = body?.notes?.trim() ?? "";

  if (jobId.trim().length === 0) {
    return NextResponse.json({ message: "Job is required." }, { status: 400 });
  }

  if (!body?.serviceLineId?.trim()) {
    return NextResponse.json({ message: "Service is required." }, { status: 400 });
  }

  return NextResponse.json({
    saved: true,
    assignmentId: jobId,
    serviceLineId: body.serviceLineId.trim(),
    notes,
    message: "Notes will be saved when you complete the service."
  });
}
