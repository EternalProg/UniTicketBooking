import type { FastifyRequest, FastifyReply } from "fastify";
import type { AdminService } from "./admin.service.js";

export class AdminController {
  constructor(private service: AdminService) {}

  stats = async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.service.getStats();
    return reply.status(200).send(stats);
  };
}
