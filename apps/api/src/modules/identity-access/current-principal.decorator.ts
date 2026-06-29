import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { AuthenticatedPrincipal, RequestWithPrincipal } from "./auth.types";

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    return request.principal;
  }
);
