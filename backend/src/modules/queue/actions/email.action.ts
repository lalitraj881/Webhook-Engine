import { Injectable, Logger } from '@nestjs/common';
import { ActionResult } from './webhook.action';

/**
 * Email Action Handler — sends notification emails.
 *
 * For this assignment, we use a mock implementation that logs the email
 * and simulates SMTP behavior. In production, you'd integrate with
 * nodemailer + Ethereal (for testing) or SendGrid/SES (for production).
 *
 * We simulate realistic latency and occasional failures for demo purposes.
 */
@Injectable()
export class EmailActionHandler {
  private readonly logger = new Logger(EmailActionHandler.name);

  async execute(
    config: { to: string; subject: string; body?: string },
    eventPayload: Record<string, any>,
  ): Promise<ActionResult> {
    const { to, subject, body } = config;
    this.logger.log(`Executing email action: to=${to}, subject="${subject}"`);

    try {
      // Simulate email sending with realistic latency
      await this.simulateEmailSend();

      // Build email content from event payload
      const emailBody =
        body ||
        `Automation triggered!\n\nEvent Details:\n${JSON.stringify(eventPayload, null, 2)}`;

      this.logger.log(
        `📧 Email sent successfully:\n` +
          `  To: ${to}\n` +
          `  Subject: ${subject}\n` +
          `  Body: ${emailBody.substring(0, 100)}...`,
      );

      return {
        success: true,
        data: {
          to,
          subject,
          sentAt: new Date().toISOString(),
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        },
      };
    } catch (error: any) {
      this.logger.error(`Email action failed: ${error.message}`);
      return {
        success: false,
        error: {
          message: error.message,
          code: 'EMAIL_SEND_FAILED',
        },
      };
    }
  }

  /**
   * Simulate email sending with realistic latency (200-800ms).
   * Has a small chance of failure to demonstrate error handling in the demo.
   */
  private async simulateEmailSend(): Promise<void> {
    const delay = 200 + Math.random() * 600;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 5% simulated failure rate for demo purposes
    if (Math.random() < 0.05) {
      throw new Error('SMTP connection refused: unable to reach mail server');
    }
  }
}
