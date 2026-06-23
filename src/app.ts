import Fastify from "fastify";
import type { AppDependencies } from "./app-contracts.js";
import { createProductionDependencies } from "./app-production.js";
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
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { loggerConfig } from "./lib/logger.js";
import { createAuthenticate } from "./middleware/authenticate.js";

export async function buildApp(
  dependencies: AppDependencies = createProductionDependencies(),
) {
  const app = Fastify({
    logger: loggerConfig,
    bodyLimit: 1048576,
    routerOptions: {
      maxParamLength: 100,
    },
  });

  await registerHelmet(app);
  await registerRateLimit(app);
  await registerCors(app);
  await registerAuth(app);
  await registerSwagger(app);
  registerErrorHandler(app);

  const authenticate = createAuthenticate(dependencies.tokenBlacklist);

  app.get("/health", async () => {
    return dependencies.healthService.getStatus();
  });

  await authRoutes(app, API_PREFIX, dependencies.authService, authenticate);
  await eventsRoutes(app, API_PREFIX, dependencies.eventsService, authenticate);
  await bookingsRoutes(app, API_PREFIX, dependencies.bookingsService, authenticate);
  await adminRoutes(app, API_PREFIX, dependencies.adminService, authenticate);

  return app;
}
