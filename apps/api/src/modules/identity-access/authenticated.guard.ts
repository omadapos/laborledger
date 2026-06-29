import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import type { RequestWithPrincipal } from "./auth.types";

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithPrincipal>();

    if (!request.principal) {
      throw new UnauthorizedException("Authentication required.");
    }

    return true;
  }
}
