/**
 * Errors a service is allowed to throw. The route wrapper maps these onto
 * status codes, so services never import `NextResponse` and stay testable
 * without a request object.
 */

export class AppError extends Error {
  readonly status: number;
  /** Machine-readable code for the client; never contains user data. */
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request", details?: unknown) {
    super(message, 400, "bad_request", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, "conflict");
  }
}

export class TooManyRequestsError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message, 429, "rate_limited");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class UpstreamError extends AppError {
  constructor(message = "Upstream service failed") {
    super(message, 502, "upstream_failed");
  }
}
