import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

export class EventsService {
  async list(params: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
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

    return {
      data: data.map(serializeEvent),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async getById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!event) return null;

    return serializeEvent(event);
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

    return serializeEvent(event);
  }

  async delete(id: string) {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return false;

    await prisma.event.delete({ where: { id } });
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
