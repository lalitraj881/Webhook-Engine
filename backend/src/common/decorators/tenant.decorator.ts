import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Custom parameter decorator to extract the tenantId from the request.
 * Usage: @CurrentTenant() tenantId: string
 *
 * The tenantId is attached to the request by the TenantMiddleware.
 */
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
