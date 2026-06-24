import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { env } from "../config/env.js";

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  if (env.NODE_ENV === "test") return;

  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.ip;
    },
    errorResponseBuilder: (_request, context) => {
      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${context.after}`,
      };
    },
  });
}
