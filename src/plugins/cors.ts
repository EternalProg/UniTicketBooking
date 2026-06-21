import type { FastifyInstance } from "fastify";
import corsPlugin from "@fastify/cors";

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(corsPlugin, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
