import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import jwtPlugin from "@fastify/jwt";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      role: "USER" | "ADMIN";
    };
    user: {
      id: string;
      role: "USER" | "ADMIN";
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(jwtPlugin, {
    secret: env.JWT_ACCESS_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  });

  app.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid or expired token",
        });
      }
    },
  );
}
