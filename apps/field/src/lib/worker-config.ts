/** Server-only worker env checks — company resolution for Field BFF routes. */

import { isFieldCompanyConfigured, requireResolvedFieldCompanyId } from "./field-company-resolver";

export function isWorkerCompanyConfigured(): boolean {
  return isFieldCompanyConfigured();
}

/** @deprecated Browser must not receive company ID for login. Use isWorkerCompanyConfigured(). */
export function getWorkerCompanyDisplayId(): string | null {
  return requireResolvedFieldCompanyId();
}
