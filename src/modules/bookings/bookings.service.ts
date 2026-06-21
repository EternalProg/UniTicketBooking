import { prisma } from "../../lib/prisma.js";
import { invalidateEventCache } from "../../lib/redis.js";
import { BookingStatus, type Prisma } from "../../generated/prisma/client.js";

export class BookingsService {
  async create(userId: string, eventId: string, quantity: number) {
    return prisma.$transaction(async (tx) => {
      const [event] = await tx.$queryRawUnsafe<
        Array<{ id: string; availableTickets: number; price: string }>
      >("SELECT id, availableTickets, price FROM Event WHERE id = ? FOR UPDATE", eventId);

      if (!event) {
        throw new BookingError("Event not found", 404);
      }

      if (event.availableTickets < quantity) {
        throw new BookingError(
          `Only ${event.availableTickets} tickets available`,
          409,
        );
      }

      const existing = await tx.booking.findUnique({
        where: { userId_eventId: { userId, eventId } },
      });

      if (existing && existing.status === BookingStatus.CONFIRMED) {
        throw new BookingError("You already have a booking for this event", 409);
      }

      if (existing && existing.status === BookingStatus.CANCELLED) {
        const booking = await tx.booking.update({
          where: { id: existing.id },
          data: {
            status: BookingStatus.CONFIRMED,
            quantity,
            totalPrice: Number(event.price) * quantity,
          },
          include: {
            event: { select: { id: true, title: true, date: true, location: true, imageUrl: true } },
          },
        });

        const diff = quantity - existing.quantity;
        if (diff > 0) {
          await tx.event.update({
            where: { id: eventId },
            data: { availableTickets: { decrement: diff } },
          });
        } else if (diff < 0) {
          await tx.event.update({
            where: { id: eventId },
            data: { availableTickets: { increment: Math.abs(diff) } },
          });
        }

        await invalidateEventCache(eventId);
        return serializeBooking(booking);
      }

      const booking = await tx.booking.create({
        data: {
          userId,
          eventId,
          quantity,
          totalPrice: Number(event.price) * quantity,
        },
        include: {
          event: { select: { id: true, title: true, date: true, location: true, imageUrl: true } },
        },
      });

      await tx.event.update({
        where: { id: eventId },
        data: { availableTickets: { decrement: quantity } },
      });

      await invalidateEventCache(eventId);
      return serializeBooking(booking);
    });
  }

  async findByUser(
    userId: string,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          event: { select: { id: true, title: true, date: true, location: true, imageUrl: true } },
        },
      }),
      prisma.booking.count({ where: { userId } }),
    ]);

    return {
      data: data.map(serializeBooking),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, userId: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, title: true, date: true, location: true, imageUrl: true } },
      },
    });

    if (!booking) return null;
    if (booking.userId !== userId) return null;

    return serializeBooking(booking);
  }

  async cancel(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: {
          event: { select: { id: true } },
        },
      });

      if (!booking) {
        throw new BookingError("Booking not found", 404);
      }

      if (booking.userId !== userId) {
        throw new BookingError("Not authorized to cancel this booking", 403);
      }

      if (booking.status !== BookingStatus.CONFIRMED) {
        throw new BookingError("Booking is already cancelled", 400);
      }

      await tx.booking.update({
        where: { id },
        data: { status: BookingStatus.CANCELLED },
      });

      await tx.event.update({
        where: { id: booking.event.id },
        data: { availableTickets: { increment: booking.quantity } },
      });

      await invalidateEventCache(booking.event.id);

      return { id, status: "CANCELLED" as const };
    });
  }

  async findAllAdmin(params: {
    page: number;
    limit: number;
    eventId?: string;
    status?: string;
  }) {
    const skip = (params.page - 1) * params.limit;
    const where: Prisma.BookingWhereInput = {};

    if (params.eventId) where.eventId = params.eventId;
    if (params.status === BookingStatus.CONFIRMED || params.status === BookingStatus.CANCELLED) {
      where.status = params.status;
    }

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, title: true, date: true, location: true } },
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      data: data.map(serializeAdminBooking),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }
}

export class BookingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

function serializeBooking(booking: {
  id: string;
  eventId: string;
  quantity: number;
  totalPrice: number | { toString(): string };
  status: string;
  event: { id: string; title: string; date: Date; location: string; imageUrl: string | null };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: booking.id,
    eventId: booking.eventId,
    quantity: booking.quantity,
    totalPrice: Number(booking.totalPrice),
    status: booking.status,
    event: {
      id: booking.event.id,
      title: booking.event.title,
      date: booking.event.date.toISOString(),
      location: booking.event.location,
      imageUrl: booking.event.imageUrl,
    },
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

function serializeAdminBooking(booking: {
  id: string;
  eventId: string;
  userId: string;
  quantity: number;
  totalPrice: number | { toString(): string };
  status: string;
  user: { id: string; name: string; email: string };
  event: { id: string; title: string; date: Date; location: string };
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: booking.id,
    eventId: booking.eventId,
    userId: booking.userId,
    quantity: booking.quantity,
    totalPrice: Number(booking.totalPrice),
    status: booking.status,
    user: booking.user,
    event: {
      id: booking.event.id,
      title: booking.event.title,
      date: booking.event.date.toISOString(),
      location: booking.event.location,
    },
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}
