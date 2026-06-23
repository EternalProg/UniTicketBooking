import type { FastifyRequest, FastifyReply } from "fastify";
import type { AdminServiceContract } from "../../app-contracts.js";

export class AdminController {
  constructor(private service: AdminServiceContract) {}

  stats = async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.service.getStats();
    return reply.status(200).send(stats);
  };
}
