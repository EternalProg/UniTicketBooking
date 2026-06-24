import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { count: vi.fn() },
  event: { count: vi.fn() },
  booking: { count: vi.fn(), aggregate: vi.fn() },
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: mockPrisma,
}));

import { AdminService } from "../../modules/admin/admin.service.js";

describe("AdminService", () => {
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService();
  });

  describe("getStats", () => {
    it("should return aggregated stats", async () => {
      mockPrisma.user.count.mockResolvedValue(10);
      mockPrisma.event.count.mockResolvedValue(5);
      mockPrisma.booking.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: 500 } });

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 10,
        totalEvents: 5,
        totalBookings: 20,
        confirmedBookings: 15,
        cancelledBookings: 5,
        totalRevenue: 500,
      });
    });

    it("should handle zero counts and null revenue", async () => {
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.event.count.mockResolvedValue(0);
      mockPrisma.booking.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.booking.aggregate.mockResolvedValue({ _sum: { totalPrice: null } });

      const result = await service.getStats();

      expect(result).toEqual({
        totalUsers: 0,
        totalEvents: 0,
        totalBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        totalRevenue: 0,
      });
    });
  });
});
