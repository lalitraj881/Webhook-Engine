import { Injectable, Logger } from '@nestjs/common';
import { WebhookActionHandler, ActionResult } from './webhook.action';
import { EmailActionHandler } from './email.action';
import { LogActionHandler } from './log.action';

/**
 * Factory pattern for action handlers.
 *
 * Design decision: Using a factory instead of a map because:
 * 1. Each handler is a NestJS injectable (can have dependencies)
 * 2. Easy to add new action types without modifying existing code (OCP)
 * 3. Type-safe at the factory level
 */
@Injectable()
export class ActionFactory {
  private readonly logger = new Logger(ActionFactory.name);

  constructor(
    private readonly webhookAction: WebhookActionHandler,
    private readonly emailAction: EmailActionHandler,
    private readonly logAction: LogActionHandler,
  ) {}

  /**
   * Execute an action by type.
   * Returns a standardized ActionResult regardless of action type.
   */
  async execute(
    actionType: string,
    actionConfig: Record<string, any>,
    eventPayload: Record<string, any>,
  ): Promise<ActionResult> {
    this.logger.log(`Dispatching action: type=${actionType}`);

    switch (actionType) {
      case 'webhook':
        return this.webhookAction.execute(
          actionConfig as { url: string; headers?: Record<string, string> },
          eventPayload,
        );
      case 'email':
        return this.emailAction.execute(
          actionConfig as { to: string; subject: string; body?: string },
          eventPayload,
        );
      case 'log':
        return this.logAction.execute(
          actionConfig as { level?: string; message?: string },
          eventPayload,
        );
      default:
        this.logger.error(`Unknown action type: ${actionType}`);
        return {
          success: false,
          error: {
            message: `Unknown action type: ${actionType}`,
            code: 'UNKNOWN_ACTION_TYPE',
          },
        };
    }
  }
}
