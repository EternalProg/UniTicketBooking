import { beforeAll, beforeEach, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import { connectRedis, disconnectRedis } from "../../lib/redis.js";
import { prisma } from "../../lib/prisma.js";
import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";

let app: FastifyInstance;
let hashedAdminPassword: string;
let hashedUserPassword: string;

beforeAll(async () => {
  await connectRedis();
  app = await buildApp();
  await app.ready();
  [hashedAdminPassword, hashedUserPassword] = await Promise.all([
    bcrypt.hash("admin123", 4),
    bcrypt.hash("user123", 4),
  ]);
});

afterAll(async () => {
  await app.close();
  await disconnectRedis();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.booking.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.createMany({
    data: [
      {
        id: "test-admin-id",
        email: "admin@test.com",
        password: hashedAdminPassword,
        name: "Admin",
        role: "ADMIN",
      },
      {
        id: "test-user-id",
        email: "user@test.com",
        password: hashedUserPassword,
        name: "User",
        role: "USER",
      },
    ],
  });

  await prisma.event.createMany({
    data: [
      {
        id: "test-event-1",
        title: "Test Event 1",
        description: "Description 1",
        date: new Date("2026-06-01T18:00:00Z"),
        location: "Location 1",
        totalTickets: 100,
        availableTickets: 100,
        price: 50,
        category: "Music",
        createdById: "test-admin-id",
      },
    ],
  });
});

export { app };
