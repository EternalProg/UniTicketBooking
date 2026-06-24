import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaEvent = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    event: mockPrismaEvent,
  },
}));

const mockRedis = vi.hoisted(() => ({
  getCachedEventList: vi.fn(),
  cacheEventList: vi.fn(),
  getCachedEvent: vi.fn(),
  cacheEvent: vi.fn(),
  invalidateEventCache: vi.fn(),
}));

vi.mock("../../lib/redis.js", () => mockRedis);

import { EventsService } from "../../modules/events/events.service.js";

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-1",
    title: "Test Event",
    description: "Description",
    date: new Date("2026-06-01T18:00:00Z"),
    location: "Location",
    totalTickets: 100,
    availableTickets: 100,
    price: 50,
    imageUrl: null,
    category: "Music",
    createdBy: { id: "admin-1", name: "Admin" },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function serialize(e: ReturnType<typeof makeEvent>) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toISOString(),
    location: e.location,
    totalTickets: e.totalTickets,
    availableTickets: e.availableTickets,
    price: Number(e.price),
    imageUrl: e.imageUrl,
    category: e.category,
    createdBy: e.createdBy,
    createdAt: e.createdAt.toISOString(),
  };
}

describe("EventsService", () => {
  let service: EventsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EventsService();
  });

  describe("list", () => {
    const params = { page: 1, limit: 10 };

    it("should return cached data when available", async () => {
      const cached = {
        data: [serialize(makeEvent())],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      };
      mockRedis.getCachedEventList.mockResolvedValue(cached);

      const result = await service.list(params);
      expect(result).toEqual(cached);
      expect(mockPrismaEvent.findMany).not.toHaveBeenCalled();
    });

    it("should query Prisma and cache on miss", async () => {
      mockRedis.getCachedEventList.mockResolvedValue(null);
      mockPrismaEvent.findMany.mockResolvedValue([makeEvent()]);
      mockPrismaEvent.count.mockResolvedValue(1);

      const result = await service.list(params);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(mockRedis.cacheEventList).toHaveBeenCalled();
    });

    it("should filter by category", async () => {
      mockRedis.getCachedEventList.mockResolvedValue(null);
      mockPrismaEvent.findMany.mockResolvedValue([]);
      mockPrismaEvent.count.mockResolvedValue(0);

      await service.list({ ...params, category: "Music" });
      expect(mockPrismaEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: "Music" } }),
      );
    });

    it("should search by title or description", async () => {
      mockRedis.getCachedEventList.mockResolvedValue(null);
      mockPrismaEvent.findMany.mockResolvedValue([]);
      mockPrismaEvent.count.mockResolvedValue(0);

      await service.list({ ...params, search: "Test" });
      expect(mockPrismaEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ title: { contains: "Test" } }, { description: { contains: "Test" } }],
          },
        }),
      );
    });

    it("should handle pagination", async () => {
      mockRedis.getCachedEventList.mockResolvedValue(null);
      mockPrismaEvent.findMany.mockResolvedValue([]);
      mockPrismaEvent.count.mockResolvedValue(25);

      const result = await service.list({ page: 3, limit: 10 });
      expect(result.pagination).toEqual({ page: 3, limit: 10, total: 25, totalPages: 3 });
    });
  });

  describe("getById", () => {
    it("should return cached event when available", async () => {
      const cached = serialize(makeEvent());
      mockRedis.getCachedEvent.mockResolvedValue(cached);

      const result = await service.getById("event-1");
      expect(result).toEqual(cached);
      expect(mockPrismaEvent.findUnique).not.toHaveBeenCalled();
    });

    it("should query Prisma and cache on miss", async () => {
      mockRedis.getCachedEvent.mockResolvedValue(null);
      mockPrismaEvent.findUnique.mockResolvedValue(makeEvent());

      const result = await service.getById("event-1");
      expect(result).toEqual(serialize(makeEvent()));
      expect(mockRedis.cacheEvent).toHaveBeenCalled();
    });

    it("should return null when not found", async () => {
      mockRedis.getCachedEvent.mockResolvedValue(null);
      mockPrismaEvent.findUnique.mockResolvedValue(null);

      const result = await service.getById("non-existent");
      expect(result).toBeNull();
      expect(mockRedis.cacheEvent).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("should create event and invalidate cache", async () => {
      const created = makeEvent({
        title: "New Event",
        totalTickets: 50,
        availableTickets: 50,
        price: 25,
      });
      mockPrismaEvent.create.mockResolvedValue(created);

      const result = await service.create({
        title: "New Event",
        description: "Desc",
        date: "2026-08-01T18:00:00Z",
        location: "Loc",
        totalTickets: 50,
        price: 25,
        createdById: "admin-1",
      });

      expect(result).toEqual(serialize(created));
      expect(mockRedis.invalidateEventCache).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update event and invalidate cache", async () => {
      const existing = makeEvent({ totalTickets: 100, availableTickets: 80 });
      mockPrismaEvent.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, title: "Updated" };
      mockPrismaEvent.update.mockResolvedValue(updated);

      const result = await service.update("event-1", { title: "Updated" });
      expect(result).toEqual(serialize(updated));
      expect(mockRedis.invalidateEventCache).toHaveBeenCalledWith("event-1");
    });

    it("should adjust availableTickets when totalTickets changes", async () => {
      const existing = makeEvent({ totalTickets: 100, availableTickets: 80 });
      mockPrismaEvent.findUnique.mockResolvedValue(existing);
      mockPrismaEvent.update.mockResolvedValue({
        ...existing,
        totalTickets: 120,
        availableTickets: 100,
      });

      await service.update("event-1", { totalTickets: 120 });
      expect(mockPrismaEvent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ totalTickets: 120, availableTickets: 100 }),
        }),
      );
    });

    it("should return null when event not found", async () => {
      mockPrismaEvent.findUnique.mockResolvedValue(null);
      const result = await service.update("non-existent", { title: "Nope" });
      expect(result).toBeNull();
      expect(mockPrismaEvent.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should delete event and invalidate cache", async () => {
      mockPrismaEvent.findUnique.mockResolvedValue(makeEvent());
      mockPrismaEvent.delete.mockResolvedValue(makeEvent());

      const result = await service.delete("event-1");
      expect(result).toBe(true);
      expect(mockRedis.invalidateEventCache).toHaveBeenCalledWith("event-1");
    });

    it("should return false when not found", async () => {
      mockPrismaEvent.findUnique.mockResolvedValue(null);
      const result = await service.delete("non-existent");
      expect(result).toBe(false);
      expect(mockPrismaEvent.delete).not.toHaveBeenCalled();
    });
  });
});
