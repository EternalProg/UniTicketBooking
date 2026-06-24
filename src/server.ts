import { buildApp } from "./app.js";
import { createProductionDependencies } from "./dependencies.production.js";
import { env } from "./config/env.js";
import { connectRedis, disconnectRedis } from "./lib/redis.js";
import { prisma } from "./lib/prisma.js";

async function start() {
  await connectRedis();
  const app = await buildApp(createProductionDependencies());

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at http://localhost:${env.PORT}`);
    app.log.info(`Swagger docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    await disconnectRedis();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start();
