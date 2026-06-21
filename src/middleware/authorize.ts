import type { FastifyRequest, FastifyReply } from "fastify";

export function authorize(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user;
    if (!user) {
      reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      reply.status(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "Insufficient permissions",
      });
      return;
    }
  };
}
