import Fastify from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "./config/env.js";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerAuth } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV !== "production"
          ? {
              target: "pino-pretty",
              options: { colorize: true },
            }
          : undefined,
    },
  }).withTypeProvider<ZodTypeProvider>();

  await registerCors(app);
  await registerAuth(app);
  await registerSwagger(app);
  registerErrorHandler(app);

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  return app;
}
