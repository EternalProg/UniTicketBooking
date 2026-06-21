import type { FastifyInstance } from "fastify";
import type { JWT } from "@fastify/jwt";
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

declare module "fastify" {
  interface FastifyInstance {
    refresh: JWT;
    generateTokens(payload: {
      id: string;
      role: "USER" | "ADMIN";
    }): { accessToken: string; refreshToken: string };
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

  app.decorate("generateTokens", (payload: { id: string; role: "USER" | "ADMIN" }) => {
    const jti = crypto.randomUUID();
    const accessToken = app.jwt.sign({ id: payload.id, role: payload.role, jti });
    const refreshToken = app.refresh.sign({ id: payload.id, jti });
    return { accessToken, refreshToken };
  });
}
