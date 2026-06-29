import { NextResponse } from "next/server";

import {
  fieldCompanyNotConfiguredMessage,
  isFieldCompanyConfigured,
  resolveFieldCompany
} from "@/lib/field-company-resolver";

export async function GET() {
  const resolution = resolveFieldCompany();

  if (resolution.status === "resolved") {
    return NextResponse.json({
      pinLoginReady: true,
      resolutionSource: resolution.source
    });
  }

  return NextResponse.json({
    pinLoginReady: false,
    resolutionSource: resolution.source,
    message: fieldCompanyNotConfiguredMessage()
  });
}

export function HEAD() {
  return new NextResponse(null, {
    status: isFieldCompanyConfigured() ? 200 : 503
  });
}
