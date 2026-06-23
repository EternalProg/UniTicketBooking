import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { EventsController } from "./events.controller.js";
import type { EventsServiceContract } from "../../app-contracts.js";
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
import { authorize } from "../../middleware/authorize.js";

type AuthenticateHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function eventsRoutes(
  app: FastifyInstance,
  prefix: string,
  service: EventsServiceContract,
  authenticate: AuthenticateHandler,
): Promise<void> {
  const controller = new EventsController(service);

  app.get(
    `${prefix}/events`,
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
    `${prefix}/events/:id`,
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
    `${prefix}/events`,
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
    `${prefix}/events/:id`,
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
    `${prefix}/events/:id`,
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
