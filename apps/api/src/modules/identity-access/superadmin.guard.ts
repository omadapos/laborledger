import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { GlobalRole } from "@prisma/client";

import type { RequestWithPrincipal } from "./auth.types";

@Injectable()
export class SuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (!request.principal) {
      throw new UnauthorizedException("Authentication required.");
    }

    if (request.principal.globalRole !== GlobalRole.PLATFORM_SUPERADMIN) {
      throw new ForbiddenException("Platform superadministrator role required.");
    }

    return true;
  }
}
