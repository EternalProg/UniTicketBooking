import { prisma } from "../../lib/prisma.js";
import type { EventsServiceContract } from "../../app-contracts.js";
import {
  cacheEventList,
  getCachedEventList,
  cacheEvent,
  getCachedEvent,
  invalidateEventCache,
} from "../../lib/redis.js";
import type { Prisma } from "../../generated/prisma/client.js";

export class EventsService implements EventsServiceContract {
  async list(params: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const cacheKey = params as unknown as Record<string, unknown>;
    const cached = await getCachedEventList<{
      data: ReturnType<typeof serializeEvent>[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(cacheKey);
    if (cached) return cached;

    const where: Prisma.EventWhereInput = {};

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search } },
        { description: { contains: params.search } },
      ];
    }

    if (params.dateFrom || params.dateTo) {
      where.date = {};
      if (params.dateFrom) where.date.gte = new Date(params.dateFrom);
      if (params.dateTo) where.date.lte = new Date(params.dateTo);
    }

    const skip = (params.page - 1) * params.limit;

    const [data, total] = await Promise.all([
      prisma.event.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { date: "asc" },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      }),
      prisma.event.count({ where }),
    ]);

    const result = {
      data: data.map(serializeEvent),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };

    await cacheEventList(cacheKey, result);
    return result;
  }

  async getById(id: string) {
    const cached = await getCachedEvent<ReturnType<typeof serializeEvent>>(id);
    if (cached) return cached;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!event) return null;

    const result = serializeEvent(event);
    await cacheEvent(id, result);
    return result;
  }

  async create(data: {
    title: string;
    description: string;
    date: string;
    location: string;
    totalTickets: number;
    price: number;
    imageUrl?: string;
    category?: string;
    createdById: string;
  }) {
    const event = await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        date: new Date(data.date),
        location: data.location,
        totalTickets: data.totalTickets,
        availableTickets: data.totalTickets,
        price: data.price,
        imageUrl: data.imageUrl ?? null,
        category: data.category ?? null,
        createdById: data.createdById,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await invalidateEventCache();
    return serializeEvent(event);
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      date?: string;
      location?: string;
      totalTickets?: number;
      price?: number;
      imageUrl?: string | null;
      category?: string | null;
    },
  ) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return null;

    const updateData: Prisma.EventUpdateInput = {};

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.location !== undefined) updateData.location = data.location;
    if (data.totalTickets !== undefined) {
      const diff = data.totalTickets - existing.totalTickets;
      updateData.totalTickets = data.totalTickets;
      updateData.availableTickets = existing.availableTickets + diff;
    }
    if (data.price !== undefined) updateData.price = data.price;
    if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
    if (data.category !== undefined) updateData.category = data.category;

    const event = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await invalidateEventCache(id);
    return serializeEvent(event);
  }

  async delete(id: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return false;

    await prisma.event.delete({ where: { id } });
    await invalidateEventCache(id);
    return true;
  }
}

function serializeEvent(event: {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  totalTickets: number;
  availableTickets: number;
  price: number | { toString(): string };
  imageUrl: string | null;
  category: string | null;
  createdBy: { id: string; name: string };
  createdAt: Date;
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date.toISOString(),
    location: event.location,
    totalTickets: event.totalTickets,
    availableTickets: event.availableTickets,
    price: Number(event.price),
    imageUrl: event.imageUrl,
    category: event.category,
    createdBy: event.createdBy,
    createdAt: event.createdAt.toISOString(),
  };
}
