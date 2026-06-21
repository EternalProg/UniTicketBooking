import type { FastifyInstance } from "fastify";
import corsPlugin from "@fastify/cors";
import { env } from "../config/env.js";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(corsPlugin, {
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || env.CORS_ORIGIN === origin) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}
