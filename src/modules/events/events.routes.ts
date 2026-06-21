import type { FastifyInstance } from "fastify";
import { EventsController } from "./events.controller.js";
import { EventsService } from "./events.service.js";
import {
  createEventBodySchema,
  createEventResponseSchema,
  updateEventBodySchema,
  eventListQuerySchema,
  eventListResponseSchema,
  eventResponseSchema,
  eventIdParamSchema,
} from "./events.schema.js";
import { toJsonSchema } from "../../lib/schema-helper.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  const service = new EventsService();
  const controller = new EventsController(service);

  app.get(
    "/events",
    {
      schema: {
        tags: ["Events"],
        description: "List events with pagination and filtering",
        querystring: toJsonSchema(eventListQuerySchema),
        response: { 200: toJsonSchema(eventListResponseSchema) },
      },
    },
    controller.list,
  );

  app.get(
    "/events/:id",
    {
      schema: {
        tags: ["Events"],
        description: "Get event details by ID",
        params: toJsonSchema(eventIdParamSchema),
        response: { 200: toJsonSchema(eventResponseSchema) },
      },
    },
    controller.getById,
  );

  app.post(
    "/events",
    {
      schema: {
        tags: ["Events"],
        description: "Create a new event (Admin only)",
        body: toJsonSchema(createEventBodySchema),
        response: { 201: toJsonSchema(createEventResponseSchema) },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate, authorize("ADMIN")],
    },
    controller.create,
  );

  app.put(
    "/events/:id",
    {
      schema: {
        tags: ["Events"],
        description: "Update an event (Admin only)",
        body: toJsonSchema(updateEventBodySchema),
        params: toJsonSchema(eventIdParamSchema),
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate, authorize("ADMIN")],
    },
    controller.update,
  );

  app.delete(
    "/events/:id",
    {
      schema: {
        tags: ["Events"],
        description: "Delete an event (Admin only)",
        params: toJsonSchema(eventIdParamSchema),
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate, authorize("ADMIN")],
    },
    controller.delete,
  );
}
