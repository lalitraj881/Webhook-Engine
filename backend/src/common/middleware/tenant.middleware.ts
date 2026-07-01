import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that extracts the tenant ID from the request.
 *
 * For the webhook ingestion endpoint, tenantId comes from the URL param.
 * For the API endpoints, tenantId comes from the X-Tenant-Id header.
 *
 * This is a simplified auth stub as specified in the brief:
 * "A simple 'login as user X' stub is fine."
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    // For webhook ingestion endpoints, tenantId is in the URL
    // Pattern: /webhooks/:tenantId/:source
    if (req.path.startsWith('/webhooks/')) {
      const parts = req.path.split('/');
      if (parts.length >= 3 && parts[2]) {
        (req as any).tenantId = parts[2];
        next();
        return;
      }
    }

    // For API endpoints, tenantId comes from header
    const tenantId = req.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new UnauthorizedException(
        'Missing X-Tenant-Id header. Set this header to identify as a tenant.',
      );
    }

    (req as any).tenantId = tenantId;
    next();
  }
}
