import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter that catches ALL unhandled exceptions.
 *
 * Why this matters:
 * - Prevents raw stack traces from leaking to clients (security)
 * - Provides consistent error response format across all endpoints
 * - Logs full error details server-side for debugging
 * - Shows NestJS depth: using @Catch() filter as a cross-cutting concern
 *
 * Response format:
 * {
 *   statusCode: number,
 *   message: string,
 *   error: string,
 *   timestamp: string,
 *   path: string
 * }
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, any>;
        message = resp.message || exception.message;
        error = resp.error || exception.name;
        // Handle ValidationPipe array of messages
        if (Array.isArray(message)) {
          message = (message as string[]).join('; ');
        }
      } else {
        message = exception.message;
        error = exception.name;
      }
    } else if (exception instanceof Error) {
      // Unexpected errors — log full details but don't expose internals
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'Internal Server Error';

      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'Internal Server Error';

      this.logger.error(`Unknown exception type: ${JSON.stringify(exception)}`);
    }

    // Log 4xx and 5xx at appropriate levels
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}: ${message}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${status}: ${message}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
