import type { FastifyInstance, FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

function isFastifyError(error: unknown): error is FastifyError {
  return error instanceof Error && "statusCode" in error;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (error: FastifyError | ZodError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode =
        (error instanceof ZodError)
          ? 400
          : isFastifyError(error) && error.statusCode
            ? error.statusCode
            : 500;

      const response: ErrorResponse = {
        statusCode,
        error: error.name ?? "InternalServerError",
        message: error.message ?? "An unexpected error occurred",
      };

      if (error instanceof ZodError) {
        response.error = "ValidationError";
        response.message = "Request validation failed";
        response.details = error.flatten();
      } else if (isFastifyError(error) && error.validation) {
        response.error = "ValidationError";
        response.message = "Request validation failed";
        response.details = error.validation;
      }

      if (response.statusCode >= 500) {
        request.log.error({ err: error }, "Internal server error");
      }

      return reply.status(response.statusCode).send(response);
    },
  );
}
