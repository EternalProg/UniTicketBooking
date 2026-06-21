import { Redis } from "ioredis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

import crypto from "node:crypto";

let redis: Redis | null = null;

const BLACKLIST_PREFIX = "blacklist:jti:";
const EVENTS_LIST_PREFIX = "events:list:";
const EVENTS_DETAIL_PREFIX = "events:detail:";

const EVENTS_LIST_TTL = 300; // 5 minutes
const EVENTS_DETAIL_TTL = 600; // 10 minutes

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

// --- Blacklist ---

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

// --- Generic cache helpers ---

async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (r.status !== "ready") return null;
  const raw = await r.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (r.status !== "ready") return;
  const serialized = JSON.stringify(value);
  await r.setex(key, ttlSeconds, serialized);
}

// --- Event cache ---

function hashQuery(params: Record<string, unknown>): string {
  const str = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash("md5").update(str).digest("hex");
}

export async function cacheEventList(
  params: Record<string, unknown>,
  data: unknown,
): Promise<void> {
  const key = `${EVENTS_LIST_PREFIX}${hashQuery(params)}`;
  await cacheSet(key, data, EVENTS_LIST_TTL);
}

export async function getCachedEventList<T>(
  params: Record<string, unknown>,
): Promise<T | null> {
  const key = `${EVENTS_LIST_PREFIX}${hashQuery(params)}`;
  return cacheGet<T>(key);
}

export async function cacheEvent(id: string, data: unknown): Promise<void> {
  const key = `${EVENTS_DETAIL_PREFIX}${id}`;
  await cacheSet(key, data, EVENTS_DETAIL_TTL);
}

export async function getCachedEvent<T>(id: string): Promise<T | null> {
  const key = `${EVENTS_DETAIL_PREFIX}${id}`;
  return cacheGet<T>(key);
}

export async function invalidateEventCache(id?: string): Promise<void> {
  const r = getRedis();
  if (r.status !== "ready") return;

  if (id) {
    await r.del(`${EVENTS_DETAIL_PREFIX}${id}`);
  }

  const stream = r.scanStream({ match: `${EVENTS_LIST_PREFIX}*`, count: 100 });
  const keys: string[] = [];
  for await (const batch of stream) {
    keys.push(...batch);
  }
  if (keys.length > 0) {
    await r.del(...keys);
  }
}

// --- Disconnect ---

export async function disconnectRedis(): Promise<void> {
  if (redis && redis.status === "ready") {
    await redis.quit();
    redis = null;
  }
}
