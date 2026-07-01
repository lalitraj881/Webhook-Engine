import { Injectable, Logger } from '@nestjs/common';
import { ActionResult } from './webhook.action';

/**
 * Log Action Handler — writes a structured log entry.
 *
 * This is the simplest action type and serves as a reliable fallback.
 * It always succeeds, making it useful for debugging and as a baseline
 * action when you want to verify the pipeline works end-to-end.
 */
@Injectable()
export class LogActionHandler {
  private readonly logger = new Logger(LogActionHandler.name);

  async execute(
    config: { level?: string; message?: string },
    eventPayload: Record<string, any>,
  ): Promise<ActionResult> {
    const level = config.level || 'info';
    const message = config.message || 'Automation rule triggered';

    const logEntry = {
      level,
      message,
      eventPayload,
      timestamp: new Date().toISOString(),
    };

    // Log based on level
    switch (level) {
      case 'warn':
        this.logger.warn(`📝 [LOG ACTION] ${message}`, JSON.stringify(logEntry));
        break;
      case 'error':
        this.logger.error(`📝 [LOG ACTION] ${message}`, JSON.stringify(logEntry));
        break;
      default:
        this.logger.log(`📝 [LOG ACTION] ${message}`, JSON.stringify(logEntry));
    }

    return {
      success: true,
      data: logEntry,
    };
  }
}
