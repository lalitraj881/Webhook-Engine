import { Injectable, Logger } from '@nestjs/common';

export interface ActionResult {
  success: boolean;
  data?: Record<string, any>;
  error?: { message: string; code?: string; httpStatus?: number };
}

/**
 * Webhook Action Handler — sends HTTP POST to a configured URL.
 *
 * This is one of the two required action types from the brief.
 * It demonstrates real downstream integration (or simulated failure for demo).
 */
@Injectable()
export class WebhookActionHandler {
  private readonly logger = new Logger(WebhookActionHandler.name);

  async execute(
    config: { url: string; headers?: Record<string, string> },
    eventPayload: Record<string, any>,
  ): Promise<ActionResult> {
    const { url, headers = {} } = config;
    this.logger.log(`Executing webhook action: POST ${url}`);

    try {
      // Use native fetch (Node 18+)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          event: eventPayload,
          timestamp: new Date().toISOString(),
          source: 'webhook-engine',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const body = await response.text().catch(() => 'No response body');
        return {
          success: false,
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            code: 'HTTP_ERROR',
            httpStatus: response.status,
          },
        };
      }

      const responseData = await response.json().catch(() => ({}));
      this.logger.log(`Webhook action succeeded: ${url} → ${response.status}`);
      return {
        success: true,
        data: { statusCode: response.status, response: responseData },
      };
    } catch (error: any) {
      this.logger.error(`Webhook action failed: ${url} → ${error.message}`);
      return {
        success: false,
        error: {
          message: error.message,
          code: error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        },
      };
    }
  }
}
