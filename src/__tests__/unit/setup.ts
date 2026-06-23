import { beforeAll, beforeEach, afterAll } from "vitest";
import { buildApp } from "../../app.js";
import type {
  AdminBookingResponse,
  AdminServiceContract,
  AppDependencies,
  AuthServiceContract,
  BookingResponse,
  BookingsServiceContract,
  EventResponse,
  EventsServiceContract,
  HealthServiceContract,
  Role,
  TokenBlacklist,
} from "../../app-contracts.js";
import type { FastifyInstance } from "fastify";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt.js";
import { BookingError } from "../../modules/bookings/bookings.service.js";
import { ConflictError, UnauthorizedError } from "../../modules/auth/auth.service.js";
import crypto from "node:crypto";

type TestUser = {
  id: string;
  email: string;
  password: string;
  name: string;
  role: Role;
  createdAt: Date;
};

type TestEvent = {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  totalTickets: number;
  availableTickets: number;
  price: number;
  imageUrl: string | null;
  category: string | null;
  createdBy: { id: string; name: string };
  createdAt: Date;
};

type TestBooking = {
  id: string;
  eventId: string;
  userId: string;
  quantity: number;
  totalPrice: number;
  status: "CONFIRMED" | "CANCELLED";
  createdAt: Date;
  updatedAt: Date;
};

class InMemoryTokenBlacklist implements TokenBlacklist {
  private blacklisted = new Set<string>();

  reset(): void {
    this.blacklisted.clear();
  }

  async blacklist(jti: string): Promise<void> {
    this.blacklisted.add(jti);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return this.blacklisted.has(jti);
  }
}

class TestStore {
  users = new Map<string, TestUser>();
  events = new Map<string, TestEvent>();
  bookings = new Map<string, TestBooking>();

  reset(): void {
    this.users.clear();
    this.events.clear();
    this.bookings.clear();

    this.users.set("test-admin-id", {
      id: "test-admin-id",
      email: "admin@test.com",
      password: "admin123",
      name: "Admin",
      role: "ADMIN",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    this.users.set("test-user-id", {
      id: "test-user-id",
      email: "user@test.com",
      password: "user123",
      name: "User",
      role: "USER",
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });

    this.events.set("test-event-1", {
      id: "test-event-1",
      title: "Test Event 1",
      description: "Description 1",
      date: new Date("2026-06-01T18:00:00Z"),
      location: "Location 1",
      totalTickets: 100,
      availableTickets: 100,
      price: 50,
      imageUrl: null,
      category: "Music",
      createdBy: { id: "test-admin-id", name: "Admin" },
      createdAt: new Date("2026-01-03T00:00:00Z"),
    });
    this.events.set("test-event-2", {
      id: "test-event-2",
      title: "Test Event 2",
      description: "Description 2",
      date: new Date("2026-07-01T18:00:00Z"),
      location: "Location 2",
      totalTickets: 1,
      availableTickets: 1,
      price: 100,
      imageUrl: null,
      category: "Theatre",
      createdBy: { id: "test-admin-id", name: "Admin" },
      createdAt: new Date("2026-01-04T00:00:00Z"),
    });
  }
}

class FakeHealthService implements HealthServiceContract {
  async getStatus() {
    return {
      status: "ok" as const,
      checks: {
        server: "ok",
        database: "ok",
        redis: "ok",
      },
      timestamp: new Date().toISOString(),
    };
  }
}

class FakeAuthService implements AuthServiceContract {
  constructor(
    private store: TestStore,
    private tokenBlacklist: TokenBlacklist,
  ) {}

  async register(data: { email: string; password: string; name: string }) {
    const existing = [...this.store.users.values()].find(
      (user) => user.email === data.email,
    );
    if (existing) {
      throw new ConflictError("Email already in use");
    }

    const id = crypto.randomUUID();
    const user: TestUser = {
      id,
      email: data.email,
      password: data.password,
      name: data.name,
      role: "USER",
      createdAt: new Date(),
    };
    this.store.users.set(id, user);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  async login(data: { email: string; password: string }) {
    const user = [...this.store.users.values()].find(
      (candidate) => candidate.email === data.email,
    );
    if (!user || user.password !== data.password) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const jti = crypto.randomUUID();
    return {
      accessToken: generateAccessToken({ id: user.id, role: user.role, jti }),
      refreshToken: generateRefreshToken({ id: user.id, jti }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = this.store.users.get(decoded.id);
      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      return {
        accessToken: generateAccessToken({
          id: user.id,
          role: user.role,
          jti: crypto.randomUUID(),
        }),
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }

      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  async logout(jti: string, ttlSeconds: number): Promise<void> {
    await this.tokenBlacklist.blacklist(jti, ttlSeconds);
  }

  async getMe(userId: string) {
    const user = this.store.users.get(userId);
    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

class FakeEventsService implements EventsServiceContract {
  constructor(private store: TestStore) {}

  async list(params: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    let events = [...this.store.events.values()].sort(
      (left, right) => left.date.getTime() - right.date.getTime(),
    );

    if (params.category) {
      events = events.filter((event) => event.category === params.category);
    }

    if (params.search) {
      const search = params.search.toLowerCase();
      events = events.filter(
        (event) =>
          event.title.toLowerCase().includes(search) ||
          event.description.toLowerCase().includes(search),
      );
    }

    if (params.dateFrom) {
      const from = new Date(params.dateFrom);
      events = events.filter((event) => event.date >= from);
    }

    if (params.dateTo) {
      const to = new Date(params.dateTo);
      events = events.filter((event) => event.date <= to);
    }

    const total = events.length;
    const skip = (params.page - 1) * params.limit;
    const data = events.slice(skip, skip + params.limit).map(serializeEvent);

    return {
      data,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }

  async getById(id: string) {
    const event = this.store.events.get(id);
    return event ? serializeEvent(event) : null;
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
    const createdBy = this.store.users.get(data.createdById);
    if (!createdBy) {
      throw new Error("Creator not found");
    }

    const event: TestEvent = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      date: new Date(data.date),
      location: data.location,
      totalTickets: data.totalTickets,
      availableTickets: data.totalTickets,
      price: data.price,
      imageUrl: data.imageUrl ?? null,
      category: data.category ?? null,
      createdBy: { id: createdBy.id, name: createdBy.name },
      createdAt: new Date(),
    };
    this.store.events.set(event.id, event);
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
    const event = this.store.events.get(id);
    if (!event) {
      return null;
    }

    if (data.totalTickets !== undefined) {
      const diff = data.totalTickets - event.totalTickets;
      event.totalTickets = data.totalTickets;
      event.availableTickets += diff;
    }

    if (data.title !== undefined) event.title = data.title;
    if (data.description !== undefined) event.description = data.description;
    if (data.date !== undefined) event.date = new Date(data.date);
    if (data.location !== undefined) event.location = data.location;
    if (data.price !== undefined) event.price = data.price;
    if (data.imageUrl !== undefined) event.imageUrl = data.imageUrl;
    if (data.category !== undefined) event.category = data.category;

    return serializeEvent(event);
  }

  async delete(id: string) {
    return this.store.events.delete(id);
  }
}

class FakeBookingsService implements BookingsServiceContract {
  constructor(private store: TestStore) {}

  async create(
    userId: string,
    eventId: string,
    quantity: number,
  ): Promise<BookingResponse> {
    const event = this.store.events.get(eventId);
    if (!event) {
      throw new BookingError("Event not found", 404);
    }

    if (event.availableTickets < quantity) {
      throw new BookingError(`Only ${event.availableTickets} tickets available`, 409);
    }

    const existing = [...this.store.bookings.values()].find(
      (booking) => booking.userId === userId && booking.eventId === eventId,
    );

    if (existing?.status === "CONFIRMED") {
      throw new BookingError("You already have a booking for this event", 409);
    }

    if (existing?.status === "CANCELLED") {
      const diff = quantity - existing.quantity;
      if (event.availableTickets < diff) {
        throw new BookingError(`Only ${event.availableTickets} tickets available`, 409);
      }

      existing.status = "CONFIRMED";
      existing.quantity = quantity;
      existing.totalPrice = event.price * quantity;
      existing.updatedAt = new Date();
      event.availableTickets -= diff;
      return serializeBooking(existing, event);
    }

    const booking: TestBooking = {
      id: crypto.randomUUID(),
      eventId,
      userId,
      quantity,
      totalPrice: event.price * quantity,
      status: "CONFIRMED",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    event.availableTickets -= quantity;
    this.store.bookings.set(booking.id, booking);
    return serializeBooking(booking, event);
  }

  async findByUser(userId: string, page: number, limit: number) {
    const bookings = [...this.store.bookings.values()]
      .filter((booking) => booking.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

    const total = bookings.length;
    const skip = (page - 1) * limit;

    return {
      data: bookings.slice(skip, skip + limit).map((booking) => {
        const event = this.store.events.get(booking.eventId)!;
        return serializeBooking(booking, event);
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string, userId: string) {
    const booking = this.store.bookings.get(id);
    if (!booking || booking.userId !== userId) {
      return null;
    }

    return serializeBooking(booking, this.store.events.get(booking.eventId)!);
  }

  async cancel(id: string, userId: string) {
    const booking = this.store.bookings.get(id);
    if (!booking) {
      throw new BookingError("Booking not found", 404);
    }

    if (booking.userId !== userId) {
      throw new BookingError("Not authorized to cancel this booking", 403);
    }

    if (booking.status !== "CONFIRMED") {
      throw new BookingError("Booking is already cancelled", 400);
    }

    booking.status = "CANCELLED";
    booking.updatedAt = new Date();
    this.store.events.get(booking.eventId)!.availableTickets += booking.quantity;

    return { id, status: "CANCELLED" as const };
  }

  async findAllAdmin(params: {
    page: number;
    limit: number;
    eventId?: string;
    status?: string;
  }) {
    let bookings = [...this.store.bookings.values()].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    if (params.eventId) {
      bookings = bookings.filter((booking) => booking.eventId === params.eventId);
    }

    if (params.status === "CONFIRMED" || params.status === "CANCELLED") {
      bookings = bookings.filter((booking) => booking.status === params.status);
    }

    const total = bookings.length;
    const skip = (params.page - 1) * params.limit;

    return {
      data: bookings.slice(skip, skip + params.limit).map((booking) => {
        const user = this.store.users.get(booking.userId)!;
        const event = this.store.events.get(booking.eventId)!;
        return serializeAdminBooking(booking, user, event);
      }),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }
}

class FakeAdminService implements AdminServiceContract {
  constructor(private store: TestStore) {}

  async getStats() {
    const bookings = [...this.store.bookings.values()];
    const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED");
    const cancelled = bookings.filter((booking) => booking.status === "CANCELLED");

    return {
      totalUsers: this.store.users.size,
      totalEvents: this.store.events.size,
      totalBookings: bookings.length,
      confirmedBookings: confirmed.length,
      cancelledBookings: cancelled.length,
      totalRevenue: confirmed.reduce((sum, booking) => sum + booking.totalPrice, 0),
    };
  }
}

function serializeEvent(event: TestEvent): EventResponse {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date.toISOString(),
    location: event.location,
    totalTickets: event.totalTickets,
    availableTickets: event.availableTickets,
    price: event.price,
    imageUrl: event.imageUrl,
    category: event.category,
    createdBy: event.createdBy,
    createdAt: event.createdAt.toISOString(),
  };
}

function serializeBooking(booking: TestBooking, event: TestEvent): BookingResponse {
  return {
    id: booking.id,
    eventId: booking.eventId,
    quantity: booking.quantity,
    totalPrice: booking.totalPrice,
    status: booking.status,
    event: {
      id: event.id,
      title: event.title,
      date: event.date.toISOString(),
      location: event.location,
      imageUrl: event.imageUrl,
    },
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

function serializeAdminBooking(
  booking: TestBooking,
  user: TestUser,
  event: TestEvent,
): AdminBookingResponse {
  return {
    id: booking.id,
    eventId: booking.eventId,
    userId: booking.userId,
    quantity: booking.quantity,
    totalPrice: booking.totalPrice,
    status: booking.status,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    event: {
      id: event.id,
      title: event.title,
      date: event.date.toISOString(),
      location: event.location,
    },
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
  };
}

const store = new TestStore();
const tokenBlacklist = new InMemoryTokenBlacklist();
const dependencies: AppDependencies = {
  authService: new FakeAuthService(store, tokenBlacklist),
  eventsService: new FakeEventsService(store),
  bookingsService: new FakeBookingsService(store),
  adminService: new FakeAdminService(store),
  tokenBlacklist,
  healthService: new FakeHealthService(),
};

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp(dependencies);
  await app.ready();
});

beforeEach(() => {
  tokenBlacklist.reset();
  store.reset();
});

afterAll(async () => {
  await app.close();
});

export { app };
