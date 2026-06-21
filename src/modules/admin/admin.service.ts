import { prisma } from "../../lib/prisma.js";

export class AdminService {
  async getStats() {
    const [
      totalUsers,
      totalEvents,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      revenueResult,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.event.count(),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.booking.count({ where: { status: "CANCELLED" } }),
      prisma.booking.aggregate({
        _sum: { totalPrice: true },
        where: { status: "CONFIRMED" },
      }),
    ]);

    return {
      totalUsers,
      totalEvents,
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      totalRevenue: Number(revenueResult._sum.totalPrice ?? 0),
    };
  }
}
