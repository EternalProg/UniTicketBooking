import { z } from "zod";

export const statsResponseSchema = z.object({
  totalUsers: z.number(),
  totalEvents: z.number(),
  totalBookings: z.number(),
  confirmedBookings: z.number(),
  cancelledBookings: z.number(),
  totalRevenue: z.number(),
});
