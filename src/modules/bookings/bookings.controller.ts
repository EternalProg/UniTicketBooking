import type { FastifyRequest, FastifyReply } from "fastify";
import type { BookingsServiceContract } from "../../app-contracts.js";
import type { BookingError } from "./bookings.service.js";
import type { z } from "zod";
import type {
  createBookingBodySchema,
  bookingListQuerySchema,
  adminBookingListQuerySchema,
  bookingIdParamSchema,
} from "./bookings.schema.js";

export class BookingsController {
  constructor(private service: BookingsServiceContract) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const { eventId, quantity } = request.body as z.infer<typeof createBookingBodySchema>;
    const userId = request.user!.id;

    try {
      const booking = await this.service.create(userId, eventId, quantity);
      return reply.status(201).send(booking);
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        const be = err as BookingError;
        return reply.status(be.statusCode).send({
          statusCode: be.statusCode,
          error: getErrorLabel(be.statusCode),
          message: be.message,
        });
      }
      throw err;
    }
  };

  listMine = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as z.infer<typeof bookingListQuerySchema>;
    const userId = request.user!.id;
    const result = await this.service.findByUser(userId, query.page, query.limit);
    return reply.status(200).send(result);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof bookingIdParamSchema>;
    const userId = request.user!.id;
    const booking = await this.service.findById(id, userId);

    if (!booking) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Booking not found",
      });
    }

    return reply.status(200).send(booking);
  };

  cancel = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof bookingIdParamSchema>;
    const userId = request.user!.id;

    try {
      const result = await this.service.cancel(id, userId);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof Error && "statusCode" in err) {
        const be = err as BookingError;
        return reply.status(be.statusCode).send({
          statusCode: be.statusCode,
          error: getErrorLabel(be.statusCode),
          message: be.message,
        });
      }
      throw err;
    }
  };

  listAll = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as z.infer<typeof adminBookingListQuerySchema>;
    const result = await this.service.findAllAdmin(query);
    return reply.status(200).send(result);
  };
}

function getErrorLabel(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "Bad Request";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 409:
      return "Conflict";
    default:
      return "Error";
  }
}
