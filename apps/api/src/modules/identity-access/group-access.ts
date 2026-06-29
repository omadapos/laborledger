import { ForbiddenException } from "@nestjs/common";
import { GroupStatus } from "@prisma/client";

export const ACCOUNT_SUSPENDED_CODE = "ACCOUNT_SUSPENDED";
export const ACCOUNT_ARCHIVED_CODE = "ACCOUNT_ARCHIVED";

export const ACCOUNT_SUSPENDED_MESSAGE =
  "This account is suspended. Contact your LaborLedger administrator.";

export const ACCOUNT_ARCHIVED_MESSAGE =
  "This account is archived and cannot be accessed.";

export type GroupAccessErrorBody = {
  code: typeof ACCOUNT_SUSPENDED_CODE | typeof ACCOUNT_ARCHIVED_CODE;
  message: string;
};

export function isTenantAccessibleGroupStatus(status: GroupStatus): boolean {
  return status === GroupStatus.ACTIVE;
}

export function buildGroupAccessError(status: GroupStatus): GroupAccessErrorBody {
  if (status === GroupStatus.SUSPENDED) {
    return {
      code: ACCOUNT_SUSPENDED_CODE,
      message: ACCOUNT_SUSPENDED_MESSAGE
    };
  }

  return {
    code: ACCOUNT_ARCHIVED_CODE,
    message: ACCOUNT_ARCHIVED_MESSAGE
  };
}

export function assertTenantAccessibleGroupStatus(status: GroupStatus): void {
  if (isTenantAccessibleGroupStatus(status)) {
    return;
  }

  const error = buildGroupAccessError(status);
  throw new ForbiddenException(error);
}

export function formatGroupLifecycleStatus(status: GroupStatus): string {
  if (status === GroupStatus.SUSPENDED) {
    return "Suspended";
  }

  if (status === GroupStatus.ARCHIVED) {
    return "Archived";
  }

  return "Active";
}
