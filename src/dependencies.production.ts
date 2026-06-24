import { prisma } from "./lib/prisma.js";
import { getRedis } from "./lib/redis.js";
import type {
  AppDependencies,
  HealthServiceContract,
  TokenBlacklist,
} from "./app-contracts.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { EventsService } from "./modules/events/events.service.js";
import { BookingsService } from "./modules/bookings/bookings.service.js";
import { AdminService } from "./modules/admin/admin.service.js";
import { blacklistToken, isTokenBlacklisted } from "./lib/redis.js";

class RedisTokenBlacklist implements TokenBlacklist {
  async blacklist(jti: string, ttlSeconds: number): Promise<void> {
    await blacklistToken(jti, ttlSeconds);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return isTokenBlacklisted(jti);
  }
}

class ProductionHealthService implements HealthServiceContract {
  async getStatus() {
    const checks: Record<string, string> = { server: "ok" };

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

    return {
      status: Object.values(checks).every((value) => value === "ok") ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    } as const;
  }
}

export function createProductionDependencies(): AppDependencies {
  const tokenBlacklist = new RedisTokenBlacklist();

  return {
    authService: new AuthService(tokenBlacklist),
    eventsService: new EventsService(),
    bookingsService: new BookingsService(),
    adminService: new AdminService(),
    tokenBlacklist,
    healthService: new ProductionHealthService(),
  };
}
