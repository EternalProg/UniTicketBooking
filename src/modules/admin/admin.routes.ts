import type { FastifyInstance } from "fastify";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { statsResponseSchema } from "./admin.schema.js";
import { toJsonSchema } from "../../lib/schema-helper.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

export async function adminRoutes(app: FastifyInstance, prefix: string): Promise<void> {
  const service = new AdminService();
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
