import type { FastifyInstance } from "fastify";
import corsPlugin from "@fastify/cors";
import { env } from "../config/env.js";

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(corsPlugin, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
