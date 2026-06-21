import type { FastifyInstance } from "fastify";
import swaggerPlugin from "@fastify/swagger";
import swaggerUiPlugin from "@fastify/swagger-ui";
import { env } from "../config/env.js";
import { SWAGGER_PATH } from "../config/constants.js";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swaggerPlugin, {
    openapi: {
      info: {
        title: "University Ticket Booking API",
        description: "Server-side API for booking tickets to university cultural events",
        version: "1.0.0",
        contact: {
          name: "University Cultural Events",
        },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUiPlugin, {
    routePrefix: SWAGGER_PATH,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });
}
