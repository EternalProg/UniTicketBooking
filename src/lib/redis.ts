import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let redis: Redis | null = null;

const BLACKLIST_PREFIX = "blacklist:jti:";

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
  }
  return redis;
}

export async function connectRedis(): Promise<void> {
  try {
    await getRedis().connect();
    logger.info("Connected to Redis");
  } catch {
    logger.warn("Redis unavailable — running without cache/blacklist");
  }
}

export async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (r.status !== "ready") return;
  await r.setex(`${BLACKLIST_PREFIX}${jti}`, ttlSeconds, "1");
}

export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const r = getRedis();
  if (r.status !== "ready") return false;
  const val = await r.get(`${BLACKLIST_PREFIX}${jti}`);
  return val === "1";
}

export async function disconnectRedis(): Promise<void> {
  if (redis && redis.status === "ready") {
    await redis.quit();
    redis = null;
  }
}
