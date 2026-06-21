import { z } from "zod";

export const createEventBodySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().datetime({ offset: true }),
  location: z.string().min(1, "Location is required"),
  totalTickets: z.number().int().positive("Must have at least 1 ticket"),
  price: z.number().min(0, "Price cannot be negative"),
  imageUrl: z.string().url().optional(),
  category: z.string().optional(),
});

export const createEventResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  location: z.string(),
  totalTickets: z.number(),
  availableTickets: z.number(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  category: z.string().nullable(),
  createdAt: z.string(),
});

export const updateEventBodySchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  date: z.string().datetime({ offset: true }).optional(),
  location: z.string().min(1).optional(),
  totalTickets: z.number().int().positive().optional(),
  price: z.number().min(0).optional(),
  imageUrl: z.string().url().optional().nullable(),
  category: z.string().optional().nullable(),
});

export const eventResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  date: z.string(),
  location: z.string(),
  totalTickets: z.number(),
  availableTickets: z.number(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  category: z.string().nullable(),
  createdBy: z.object({
    id: z.string(),
    name: z.string(),
  }),
  createdAt: z.string(),
});

export const eventListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  category: z.string().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const eventListResponseSchema = z.object({
  data: z.array(eventResponseSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
});

export const eventIdParamSchema = z.object({
  id: z.string(),
});
