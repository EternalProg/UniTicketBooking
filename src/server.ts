import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis, disconnectRedis } from "./lib/redis.js";

async function start() {
  await connectRedis();
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running at http://localhost:${env.PORT}`);
    app.log.info(`Swagger docs at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
