import type { FastifyInstance } from "fastify";
import jwtPlugin from "@fastify/jwt";
import { env } from "../config/env.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      role?: "USER" | "ADMIN";
      jti: string;
    };
    user: {
      id: string;
      role: "USER" | "ADMIN";
      jti: string;
    };
  }
}

export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(jwtPlugin, {
    secret: env.JWT_ACCESS_SECRET,
    sign: {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    },
  });

  await app.register(jwtPlugin, {
    secret: env.JWT_REFRESH_SECRET,
    sign: {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    namespace: "refresh",
  });
}
