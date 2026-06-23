import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AuthController } from "./auth.controller.js";
import type { AuthServiceContract } from "../../app-contracts.js";
import {
  registerBodySchema,
  registerResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  refreshBodySchema,
  refreshResponseSchema,
  meResponseSchema,
} from "./auth.schema.js";
import { toJsonSchema } from "../../lib/schema-helper.js";

type AuthenticateHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function authRoutes(
  app: FastifyInstance,
  prefix: string,
  service: AuthServiceContract,
  authenticate: AuthenticateHandler,
): Promise<void> {
  const controller = new AuthController(service);

  app.post(
    `${prefix}/auth/register`,
    {
      config: {
        rateLimit: { max: 5, timeWindow: "15 minutes" },
      },
      schema: {
        tags: ["Auth"],
        description: "Register a new user",
        body: toJsonSchema(registerBodySchema),
        response: { 201: toJsonSchema(registerResponseSchema) },
      },
    },
    controller.register,
  );

  app.post(
    `${prefix}/auth/login`,
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
      schema: {
        tags: ["Auth"],
        description: "Login and get access + refresh tokens",
        body: toJsonSchema(loginBodySchema),
        response: { 200: toJsonSchema(loginResponseSchema) },
      },
    },
    controller.login,
  );

  app.post(
    `${prefix}/auth/refresh`,
    {
      config: {
        rateLimit: { max: 10, timeWindow: "15 minutes" },
      },
      schema: {
        tags: ["Auth"],
        description: "Get a new access token using a refresh token",
        body: toJsonSchema(refreshBodySchema),
        response: { 200: toJsonSchema(refreshResponseSchema) },
      },
    },
    controller.refresh,
  );

  app.post(
    `${prefix}/auth/logout`,
    {
      schema: {
        tags: ["Auth"],
        description: "Logout and blacklist the current token",
        response: {
          200: {
            type: "object",
            properties: { message: { type: "string" } },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate],
    },
    controller.logout,
  );

  app.get(
    `${prefix}/auth/me`,
    {
      schema: {
        tags: ["Auth"],
        description: "Get current user profile",
        response: { 200: toJsonSchema(meResponseSchema) },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate],
    },
    controller.me,
  );
}
