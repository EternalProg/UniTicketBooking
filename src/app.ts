import Fastify from "fastify";
import { API_PREFIX } from "./config/constants.js";
import { registerCors } from "./plugins/cors.js";
import { registerSwagger } from "./plugins/swagger.js";
import { registerAuth } from "./plugins/auth.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { eventsRoutes } from "./modules/events/events.routes.js";
import { bookingsRoutes } from "./modules/bookings/bookings.routes.js";
import { loggerConfig } from "./lib/logger.js";

export async function buildApp() {
  const app = Fastify({ logger: loggerConfig });

  await registerCors(app);
  await registerAuth(app);
  await registerSwagger(app);
  registerErrorHandler(app);

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  await app.register(
    async (instance) => {
      await authRoutes(instance);
      await eventsRoutes(instance);
      await bookingsRoutes(instance);
    },
    { prefix: API_PREFIX },
  );

  return app;
}
