export type Role = "USER" | "ADMIN";

export interface TokenBlacklist {
  blacklist(jti: string, ttlSeconds: number): Promise<void>;
  isBlacklisted(jti: string): Promise<boolean>;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  checks: Record<string, string>;
  timestamp: string;
}

export interface HealthServiceContract {
  getStatus(): Promise<HealthStatus>;
}

export interface AuthServiceContract {
  register(data: { email: string; password: string; name: string }): Promise<{
    id: string;
    email: string;
    name: string;
    role: Role;
  }>;
  login(data: { email: string; password: string }): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
    };
  }>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string }>;
  logout(jti: string, ttlSeconds: number): Promise<void>;
  getMe(userId: string): Promise<{
    id: string;
    email: string;
    name: string;
    role: Role;
    createdAt: string;
  }>;
}

export interface EventsServiceContract {
  list(params: {
    page: number;
    limit: number;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{
    data: EventResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  getById(id: string): Promise<EventResponse | null>;
  create(data: {
    title: string;
    description: string;
    date: string;
    location: string;
    totalTickets: number;
    price: number;
    imageUrl?: string;
    category?: string;
    createdById: string;
  }): Promise<EventResponse>;
  update(
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
  ): Promise<EventResponse | null>;
  delete(id: string): Promise<boolean>;
}

export interface EventResponse {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  totalTickets: number;
  availableTickets: number;
  price: number;
  imageUrl: string | null;
  category: string | null;
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface BookingResponse {
  id: string;
  eventId: string;
  quantity: number;
  totalPrice: number;
  status: string;
  event: {
    id: string;
    title: string;
    date: string;
    location: string;
    imageUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AdminBookingResponse {
  id: string;
  eventId: string;
  userId: string;
  quantity: number;
  totalPrice: number;
  status: string;
  user: { id: string; name: string; email: string };
  event: { id: string; title: string; date: string; location: string };
  createdAt: string;
  updatedAt: string;
}

export interface BookingsServiceContract {
  create(userId: string, eventId: string, quantity: number): Promise<BookingResponse>;
  findByUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: BookingResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
  findById(id: string, userId: string): Promise<BookingResponse | null>;
  cancel(id: string, userId: string): Promise<{ id: string; status: "CANCELLED" }>;
  findAllAdmin(params: {
    page: number;
    limit: number;
    eventId?: string;
    status?: string;
  }): Promise<{
    data: AdminBookingResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>;
}

export interface AdminServiceContract {
  getStats(): Promise<{
    totalUsers: number;
    totalEvents: number;
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
  }>;
}

export interface AppDependencies {
  authService: AuthServiceContract;
  eventsService: EventsServiceContract;
  bookingsService: BookingsServiceContract;
  adminService: AdminServiceContract;
  tokenBlacklist: TokenBlacklist;
  healthService: HealthServiceContract;
}
