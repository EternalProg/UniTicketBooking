import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BookingsController } from "./bookings.controller.js";
import type { BookingsServiceContract } from "../../app-contracts.js";
import {
  createBookingBodySchema,
  bookingResponseSchema,
  bookingListResponseSchema,
  bookingListQuerySchema,
  adminBookingListQuerySchema,
  bookingIdParamSchema,
} from "./bookings.schema.js";
import { toJsonSchema } from "../../lib/schema-helper.js";
import { authorize } from "../../middleware/authorize.js";

type AuthenticateHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function bookingsRoutes(
  app: FastifyInstance,
  prefix: string,
  service: BookingsServiceContract,
  authenticate: AuthenticateHandler,
): Promise<void> {
  const controller = new BookingsController(service);

  app.post(
    `${prefix}/bookings`,
    {
      schema: {
        tags: ["Bookings"],
        description: "Create a booking (tickets reserved transactionally)",
        body: toJsonSchema(createBookingBodySchema),
        response: { 201: toJsonSchema(bookingResponseSchema) },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate, authorize("USER", "ADMIN")],
    },
    controller.create,
  );

  app.get(
    `${prefix}/bookings`,
    {
      schema: {
        tags: ["Bookings"],
        description: "List current user's bookings",
        querystring: toJsonSchema(bookingListQuerySchema),
        response: { 200: toJsonSchema(bookingListResponseSchema) },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate],
    },
    controller.listMine,
  );

  app.get(
    `${prefix}/bookings/:id`,
    {
      schema: {
        tags: ["Bookings"],
        description: "Get a single booking by ID",
        params: toJsonSchema(bookingIdParamSchema),
        response: { 200: toJsonSchema(bookingResponseSchema) },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate],
    },
    controller.getById,
  );

  app.patch(
    `${prefix}/bookings/:id/cancel`,
    {
      schema: {
        tags: ["Bookings"],
        description: "Cancel a confirmed booking (tickets returned to pool)",
        params: toJsonSchema(bookingIdParamSchema),
        response: {
          200: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string" },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate],
    },
    controller.cancel,
  );

  app.get(
    `${prefix}/admin/bookings`,
    {
      schema: {
        tags: ["Bookings"],
        description: "List all bookings (Admin only)",
        querystring: toJsonSchema(adminBookingListQuerySchema),
        response: {
          200: {
            type: "object",
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    eventId: { type: "string" },
                    userId: { type: "string" },
                    quantity: { type: "number" },
                    totalPrice: { type: "number" },
                    status: { type: "string" },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                    event: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        title: { type: "string" },
                        date: { type: "string" },
                        location: { type: "string" },
                      },
                    },
                    createdAt: { type: "string" },
                    updatedAt: { type: "string" },
                  },
                },
              },
              pagination: {
                type: "object",
                properties: {
                  page: { type: "number" },
                  limit: { type: "number" },
                  total: { type: "number" },
                  totalPages: { type: "number" },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate, authorize("ADMIN")],
    },
    controller.listAll,
  );
}
