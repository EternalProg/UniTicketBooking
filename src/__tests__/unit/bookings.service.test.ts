import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTx = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
  booking: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  event: { update: vi.fn() },
}));

const mockPrismaBooking = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    $transaction: vi.fn((cb: any) => cb(mockTx)),
    booking: mockPrismaBooking,
    event: { findUnique: vi.fn() },
  },
}));

vi.mock("../../lib/redis.js", () => ({
  invalidateEventCache: vi.fn(),
}));

vi.mock("../../generated/prisma/client.js", () => ({
  BookingStatus: { CONFIRMED: "CONFIRMED", CANCELLED: "CANCELLED" },
}));

import { BookingsService } from "../../modules/bookings/bookings.service.js";
import * as redisModule from "../../lib/redis.js";

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    eventId: "event-1",
    userId: "user-1",
    quantity: 2,
    totalPrice: 100,
    status: "CONFIRMED",
    event: {
      id: "event-1",
      title: "Test Event",
      date: new Date("2026-06-01T18:00:00Z"),
      location: "Location",
      imageUrl: null,
    },
    createdAt: new Date("2026-03-01T00:00:00Z"),
    updatedAt: new Date("2026-03-01T00:00:00Z"),
    ...overrides,
  };
}

function serialize(b: ReturnType<typeof makeBooking>) {
  return {
    id: b.id,
    eventId: b.eventId,
    quantity: b.quantity,
    totalPrice: Number(b.totalPrice),
    status: b.status,
    event: {
      id: b.event.id,
      title: b.event.title,
      date: b.event.date.toISOString(),
      location: b.event.location,
      imageUrl: b.event.imageUrl,
    },
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

describe("BookingsService", () => {
  let service: BookingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BookingsService();
  });

  describe("create", () => {
    it("should create a booking successfully", async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([
        { id: "event-1", availableTickets: 100, price: "50.00" },
      ]);
      mockTx.booking.findUnique.mockResolvedValue(null);
      mockTx.booking.create.mockResolvedValue(makeBooking());

      const result = await service.create("user-1", "event-1", 2);
      expect(result).toEqual(serialize(makeBooking()));
      expect(mockTx.event.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { availableTickets: { decrement: 2 } },
      });
      expect(redisModule.invalidateEventCache).toHaveBeenCalledWith("event-1");
    });

    it("should reject with 404 when event not found", async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([]);
      await expect(service.create("user-1", "no-such", 1)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should reject with 409 when not enough tickets", async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([
        { id: "event-1", availableTickets: 1, price: "50.00" },
      ]);
      mockTx.booking.findUnique.mockResolvedValue(null);
      await expect(service.create("user-1", "event-1", 5)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("should reject duplicate with 409", async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([
        { id: "event-1", availableTickets: 100, price: "50.00" },
      ]);
      mockTx.booking.findUnique.mockResolvedValue(makeBooking({ status: "CONFIRMED" }));
      await expect(service.create("user-1", "event-1", 2)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("should reactivate cancelled booking and adjust tickets", async () => {
      mockTx.$queryRawUnsafe.mockResolvedValue([
        { id: "event-1", availableTickets: 100, price: "50.00" },
      ]);
      mockTx.booking.findUnique.mockResolvedValue(
        makeBooking({ status: "CANCELLED", quantity: 1, totalPrice: 50 }),
      );
      mockTx.booking.update.mockResolvedValue(
        makeBooking({ quantity: 3, totalPrice: 150 }),
      );

      const result = await service.create("user-1", "event-1", 3);
      expect(result).toEqual(serialize(makeBooking({ quantity: 3, totalPrice: 150 })));
      expect(mockTx.event.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { availableTickets: { decrement: 2 } },
      });
    });
  });

  describe("findByUser", () => {
    it("should return paginated bookings", async () => {
      mockPrismaBooking.findMany.mockResolvedValue([makeBooking()]);
      mockPrismaBooking.count.mockResolvedValue(1);

      const result = await service.findByUser("user-1", 1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe("findById", () => {
    it("should return booking when owned by user", async () => {
      mockPrismaBooking.findUnique.mockResolvedValue(makeBooking());
      const result = await service.findById("booking-1", "user-1");
      expect(result).toEqual(serialize(makeBooking()));
    });

    it("should return null for another user's booking", async () => {
      mockPrismaBooking.findUnique.mockResolvedValue(
        makeBooking({ userId: "other-user" }),
      );
      const result = await service.findById("booking-1", "user-1");
      expect(result).toBeNull();
    });

    it("should return null when not found", async () => {
      mockPrismaBooking.findUnique.mockResolvedValue(null);
      const result = await service.findById("nope", "user-1");
      expect(result).toBeNull();
    });
  });

  describe("cancel", () => {
    it("should cancel and return tickets", async () => {
      mockTx.booking.findUnique.mockResolvedValue(
        makeBooking({ event: { id: "event-1" } }),
      );
      mockTx.booking.update.mockResolvedValue(undefined);
      mockTx.event.update.mockResolvedValue(undefined);

      const result = await service.cancel("booking-1", "user-1");
      expect(result).toEqual({ id: "booking-1", status: "CANCELLED" });
      expect(mockTx.event.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { availableTickets: { increment: 2 } },
      });
    });

    it("should throw 404 when booking not found", async () => {
      mockTx.booking.findUnique.mockResolvedValue(null);
      await expect(service.cancel("nope", "user-1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should throw 403 for another user's booking", async () => {
      mockTx.booking.findUnique.mockResolvedValue(
        makeBooking({ userId: "other", event: { id: "event-1" } }),
      );
      await expect(service.cancel("booking-1", "user-1")).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("should throw 400 when already cancelled", async () => {
      mockTx.booking.findUnique.mockResolvedValue(
        makeBooking({ status: "CANCELLED", event: { id: "event-1" } }),
      );
      await expect(service.cancel("booking-1", "user-1")).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe("findAllAdmin", () => {
    const adminBooking = makeBooking({
      userId: "user-1",
      user: { id: "user-1", name: "User", email: "user@test.com" },
      event: { id: "event-1", title: "Event", date: new Date(), location: "Loc" },
    });

    function adminSerialize(b: typeof adminBooking) {
      return {
        id: b.id,
        eventId: b.eventId,
        userId: b.userId,
        quantity: b.quantity,
        totalPrice: Number(b.totalPrice),
        status: b.status,
        user: b.user,
        event: {
          id: b.event.id,
          title: b.event.title,
          date: b.event.date.toISOString(),
          location: b.event.location,
        },
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      };
    }

    it("should return all bookings for admin", async () => {
      mockPrismaBooking.findMany.mockResolvedValue([adminBooking]);
      mockPrismaBooking.count.mockResolvedValue(1);

      const result = await service.findAllAdmin({ page: 1, limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual(adminSerialize(adminBooking));
    });

    it("should filter by eventId", async () => {
      mockPrismaBooking.findMany.mockResolvedValue([]);
      mockPrismaBooking.count.mockResolvedValue(0);

      await service.findAllAdmin({ page: 1, limit: 10, eventId: "event-1" });
      expect(mockPrismaBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: "event-1" } }),
      );
    });

    it("should filter by status", async () => {
      mockPrismaBooking.findMany.mockResolvedValue([]);
      mockPrismaBooking.count.mockResolvedValue(0);

      await service.findAllAdmin({ page: 1, limit: 10, status: "CONFIRMED" });
      expect(mockPrismaBooking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "CONFIRMED" } }),
      );
    });
  });
});
