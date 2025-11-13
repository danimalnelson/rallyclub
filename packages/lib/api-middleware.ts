/**
 * Composable API middleware utilities
 * 
 * Provides reusable middleware patterns for API routes including
 * request tracing, error handling, and logging.
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiErrors } from "./api-errors";

/**
 * Request context with correlation ID for tracing
 */
export interface RequestContext {
  correlationId: string;
  startTime: number;
  method: string;
  path: string;
}

/**
 * Generate unique correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create request context for tracing and logging
 */
export function createRequestContext(req: NextRequest): RequestContext {
  return {
    correlationId: req.headers.get("x-correlation-id") || generateCorrelationId(),
    startTime: Date.now(),
    method: req.method,
    path: req.nextUrl.pathname,
  };
}

/**
 * Log request with correlation ID and timing
 */
export function logRequest(
  context: RequestContext,
  status: number,
  error?: Error
) {
  const duration = Date.now() - context.startTime;
  const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
  
  const logData = {
    level,
    correlationId: context.correlationId,
    method: context.method,
    path: context.path,
    status,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
    ...(error && { error: error.message, stack: error.stack }),
  };

  console.log(JSON.stringify(logData));
}

/**
 * API route handler type
 */
export type ApiHandler<T = any> = (
  req: NextRequest,
  context: RequestContext
) => Promise<NextResponse<T>>;

/**
 * Wrap API handler with middleware (error handling, logging, tracing)
 * 
 * @example
 * export const GET = withMiddleware(async (req, context) => {
 *   // Your handler logic with automatic error handling and logging
 *   return NextResponse.json({ data: "success" });
 * });
 */
export function withMiddleware<T = any>(
  handler: ApiHandler<T>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    const context = createRequestContext(req);

    try {
      const response = await handler(req, context);
      
      // Add correlation ID to response headers
      response.headers.set("x-correlation-id", context.correlationId);
      
      // Log successful request
      logRequest(context, response.status);
      
      return response;
    } catch (error) {
      // Log error with context
      logRequest(context, 500, error as Error);
      
      // Return standardized error response
      const errorResponse = ApiErrors.internalError(
        process.env.NODE_ENV === "development" 
          ? (error as Error).message 
          : "An unexpected error occurred"
      );
      
      errorResponse.headers.set("x-correlation-id", context.correlationId);
      
      return errorResponse as NextResponse;
    }
  };
}

/**
 * Middleware for methods that require request body
 * Parses JSON and handles parse errors gracefully
 */
export async function parseRequestBody<T = any>(
  req: NextRequest
): Promise<{ data?: T; error?: NextResponse }> {
  try {
    const data = await req.json();
    return { data };
  } catch (error) {
    return {
      error: ApiErrors.badRequest("Invalid JSON in request body"),
    };
  }
}

/**
 * Combine multiple middleware functions
 * 
 * @example
 * const handler = compose(
 *   withAuth,
 *   withRateLimit,
 *   withValidation
 * )(async (req, context) => {
 *   return NextResponse.json({ success: true });
 * });
 */
export function compose<T = any>(
  ...middlewares: Array<(handler: ApiHandler<T>) => ApiHandler<T>>
): (handler: ApiHandler<T>) => ApiHandler<T> {
  return (handler: ApiHandler<T>) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    );
  };
}

/**
 * Middleware to add cache headers to responses
 */
export function withCacheHeaders(
  maxAge: number,
  sMaxAge?: number
): (handler: ApiHandler) => ApiHandler {
  return (handler: ApiHandler) => {
    return async (req: NextRequest, context: RequestContext) => {
      const response = await handler(req, context);
      
      response.headers.set(
        "Cache-Control",
        `public, max-age=${maxAge}${sMaxAge ? `, s-maxage=${sMaxAge}` : ""}`
      );
      
      return response;
    };
  };
}

/**
 * Middleware to handle OPTIONS requests (CORS preflight)
 */
export function withCORS(
  origins: string[] = ["*"]
): (handler: ApiHandler) => ApiHandler {
  return (handler: ApiHandler) => {
    return async (req: NextRequest, context: RequestContext) => {
      // Handle preflight
      if (req.method === "OPTIONS") {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": origins[0],
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "86400",
          },
        });
      }

      const response = await handler(req, context);
      
      // Add CORS headers to response
      response.headers.set("Access-Control-Allow-Origin", origins[0]);
      
      return response;
    };
  };
}

