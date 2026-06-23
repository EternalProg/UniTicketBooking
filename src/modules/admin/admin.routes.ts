import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AdminController } from "./admin.controller.js";
import type { AdminServiceContract } from "../../app-contracts.js";
import { statsResponseSchema } from "./admin.schema.js";
import { toJsonSchema } from "../../lib/schema-helper.js";
import { authorize } from "../../middleware/authorize.js";

type AuthenticateHandler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void>;

export async function adminRoutes(
  app: FastifyInstance,
  prefix: string,
  service: AdminServiceContract,
  authenticate: AuthenticateHandler,
): Promise<void> {
  const controller = new AdminController(service);

  app.get(
    `${prefix}/admin/stats`,
    {
      schema: {
        tags: ["Admin"],
        description: "Get system statistics (Admin only)",
        response: { 200: toJsonSchema(statsResponseSchema) },
        security: [{ bearerAuth: [] }],
      },
      preHandler: [authenticate, authorize("ADMIN")],
    },
    controller.stats,
  );
}
