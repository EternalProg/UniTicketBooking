import Fastify from "fastify";
import { API_PREFIX } from "./config/constants.js";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerAuth } from "./plugins/auth.js";
import { registerRateLimit } from "./plugins/rate-limit.js";
import { registerHelmet } from "./plugins/helmet.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { bookingsRoutes } from "./modules/bookings/bookings.routes.js";
import { loggerConfig } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { getRedis } from "./lib/redis.js";

export async function buildApp() {
  const app = Fastify({
    logger: loggerConfig,
    maxParamLength: 100,
    bodyLimit: 1048576,
  });

  await registerHelmet(app);
  await registerRateLimit(app);
  await registerCors(app);
  await registerAuth(app);
  await registerSwagger(app);
  registerErrorHandler(app);

  app.get("/health", async () => {
    const checks: Record<string, string> = {};

    checks.server = "ok";

    try {
      await prisma.$queryRawUnsafe("SELECT 1");
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    try {
      const redis = getRedis();
      if (redis.status === "ready") {
        await redis.ping();
        checks.redis = "ok";
      } else {
        checks.redis = "disconnected";
      }
    } catch {
      checks.redis = "error";
    }

    const allOk = Object.values(checks).every((v) => v === "ok");

    return {
      status: allOk ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
  });

  authRoutes(app, API_PREFIX);
  eventsRoutes(app, API_PREFIX);
  bookingsRoutes(app, API_PREFIX);

  return app;
}
