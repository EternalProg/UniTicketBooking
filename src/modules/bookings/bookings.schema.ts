import { z } from "zod";

export const createBookingBodySchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
});

export const bookingResponseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  quantity: z.number(),
  totalPrice: z.number(),
  status: z.enum(["CONFIRMED", "CANCELLED"]),
  event: z.object({
    id: z.string(),
    title: z.string(),
    date: z.string(),
    location: z.string(),
    imageUrl: z.string().nullable(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const bookingListResponseSchema = z.object({
  data: z.array(bookingResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export const bookingListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const adminBookingListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  eventId: z.string().optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
});

export const bookingIdParamSchema = z.object({
  id: z.string().min(1, "Booking ID is required"),
});
