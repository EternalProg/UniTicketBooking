import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthServiceContract } from "../../app-contracts.js";
import { UnauthorizedError, ConflictError } from "./auth.service.js";
import type { z } from "zod";
import type {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
} from "./auth.schema.js";

export class AuthController {
  constructor(private service: AuthServiceContract) {}

  register = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof registerBodySchema>;
      const user = await this.service.register(body);
      return reply.status(201).send(user);
    } catch (err) {
      if (err instanceof ConflictError) {
        return reply.status(409).send({
          statusCode: 409,
          error: "Conflict",
          message: err.message,
        });
      }
      throw err;
    }
  };

  login = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof loginBodySchema>;
      const result = await this.service.login(body);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: err.message,
        });
      }
      throw err;
    }
  };

  refresh = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as z.infer<typeof refreshBodySchema>;
      const result = await this.service.refreshToken(body.refreshToken);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: err.message,
        });
      }
      throw err;
    }
  };

  logout = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (user?.jti) {
      const ttl = parseJwtTtl(request);
      if (ttl > 0) {
        await this.service.logout(user.jti, ttl);
      }
    }
    return reply.status(200).send({ message: "Logged out successfully" });
  };

  me = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const profile = await this.service.getMe(user.id);
    return reply.status(200).send(profile);
  };
}

function parseJwtTtl(request: FastifyRequest): number {
  try {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token) return 0;
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
    const exp = payload.exp as number;
    return Math.max(0, exp - Math.floor(Date.now() / 1000));
  } catch {
    return 0;
  }
}
