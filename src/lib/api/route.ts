import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/auth";
import dbConnect from "@/lib/dbConnect";
import {
  AppError, BadRequestError, TooManyRequestsError, UnauthorizedError,
} from "@/lib/api/errors";

/** The authenticated caller, as every handler needs it. */
export interface RouteContext<TParams = Record<string, string>> {
  userId: string;
  params: TParams;
  request: Request;
}

type Handler<TParams> = (ctx: RouteContext<TParams>) => Promise<unknown>;

interface HandlerOptions {
  /** Skip the session check — only for the unauthenticated auth endpoints. */
  public?: boolean;
  /** HTTP status for a successful response. Defaults to 200. */
  status?: number;
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function errorResponse(error: AppError) {
  const body: Record<string, unknown> = { error: error.message, code: error.code };
  if (error.details !== undefined) body.details = error.details;

  const response = NextResponse.json(body, { status: error.status });
  if (error instanceof TooManyRequestsError) {
    response.headers.set("Retry-After", String(error.retryAfterSeconds));
  }
  return response;
}

/**
 * Wraps a route handler with the four things every route in this app needs:
 * session check, database connection, error-to-status mapping, and JSON
 * serialization. Handlers return plain data and throw `AppError` subclasses.
 *
 * Unexpected errors are logged server-side and surfaced as a bare 500 so an
 * internal message (a Mongo error naming a collection, say) never reaches the
 * client.
 */
export function handler<TParams extends Record<string, string> = Record<string, string>>(
  fn: Handler<TParams>,
  { public: isPublic = false, status = 200 }: HandlerOptions = {}
) {
  return async (
    request: Request,
    routeArgs?: { params?: TParams }
  ): Promise<NextResponse> => {
    try {
      let userId = "";

      if (!isPublic) {
        const session = await auth();
        const sessionUserId = session?.user?.id;
        // A stale JWT can carry a non-ObjectId subject from an older build;
        // treating it as unauthenticated forces a clean re-login.
        if (!sessionUserId || !OBJECT_ID.test(sessionUserId)) {
          throw new UnauthorizedError();
        }
        userId = sessionUserId;
      }

      await dbConnect();

      const data = await fn({
        userId,
        params: (routeArgs?.params ?? {}) as TParams,
        request,
      });

      if (data === undefined) return new NextResponse(null, { status: 204 });
      return NextResponse.json(data, { status });
    } catch (error) {
      if (error instanceof AppError) return errorResponse(error);

      if (error instanceof ZodError) {
        return errorResponse(
          new BadRequestError(error.issues[0]?.message ?? "Invalid request", {
            issues: error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            })),
          })
        );
      }

      console.error(`Unhandled error in ${request.method} ${request.url}:`, error);
      return NextResponse.json(
        { error: "Internal server error", code: "internal_error" },
        { status: 500 }
      );
    }
  };
}

/** Parses a JSON body against a schema, turning both failure modes into a 400. */
export async function parseBody<TSchema extends ZodType>(
  request: Request,
  schema: TSchema
): Promise<TSchema["_output"]> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Parses route params (`{ id }`, `{ walletId, txId }`, …). */
export function parseParams<TSchema extends ZodType>(
  params: unknown,
  schema: TSchema
): TSchema["_output"] {
  return schema.parse(params);
}

/** Parses `?page=&limit=` style query strings. */
export function parseQuery<TSchema extends ZodType>(
  request: Request,
  schema: TSchema
): TSchema["_output"] {
  const url = new URL(request.url);
  return schema.parse(Object.fromEntries(url.searchParams.entries()));
}
