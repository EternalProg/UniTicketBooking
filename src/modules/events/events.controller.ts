import type { FastifyRequest, FastifyReply } from "fastify";
import type { EventsService } from "./events.service.js";
import type { z } from "zod";
import type {
  createEventBodySchema,
  updateEventBodySchema,
  eventListQuerySchema,
  eventIdParamSchema,
} from "./events.schema.js";

export class EventsController {
  constructor(private service: EventsService) {}

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as z.infer<typeof eventListQuerySchema>;
    const result = await this.service.list(query);
    return reply.status(200).send(result);
  };

  getById = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof eventIdParamSchema>;
    const event = await this.service.getById(id);
    if (!event) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Event not found",
      });
    }
    return reply.status(200).send(event);
  };

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof createEventBodySchema>;
    const userId = request.user!.id;
    const event = await this.service.create({
      ...body,
      createdById: userId,
    });
    return reply.status(201).send(event);
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof eventIdParamSchema>;
    const body = request.body as z.infer<typeof updateEventBodySchema>;
    const event = await this.service.update(id, body);
    if (!event) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Event not found",
      });
    }
    return reply.status(200).send(event);
  };

  delete = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof eventIdParamSchema>;
    const deleted = await this.service.delete(id);
    if (!deleted) {
      return reply.status(404).send({
        statusCode: 404,
        error: "Not Found",
        message: "Event not found",
      });
    }
    return reply.status(200).send({ message: "Event deleted" });
  };
}
