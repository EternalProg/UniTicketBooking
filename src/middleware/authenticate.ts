import type { FastifyRequest, FastifyReply } from "fastify";
import type { TokenBlacklist } from "../app-contracts.js";

export function createAuthenticate(tokenBlacklist: TokenBlacklist) {
  return async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid or expired token",
      });
      return;
    }

    const jti = request.user?.jti;
    if (jti && (await tokenBlacklist.isBlacklisted(jti))) {
      reply.status(401).send({
        statusCode: 401,
        error: "Unauthorized",
        message: "Token has been revoked",
      });
      return;
    }
  };
}

export function createOptionalAuth(tokenBlacklist: TokenBlacklist) {
  return async function optionalAuth(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    try {
      await request.jwtVerify();
      const jti = request.user?.jti;
      if (jti && (await tokenBlacklist.isBlacklisted(jti))) {
        request.user = undefined as never;
      }
    } catch {
      // not authenticated — that is OK
    }
  };
}
