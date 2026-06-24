import { describe, it, expect } from "vitest";
import { app } from "./setup.js";
import { getAccessToken, getAdminToken } from "./helpers.js";

describe("Bookings — POST /api/bookings", () => {
  it("should create a booking and decrement available tickets", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 2 },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.quantity).toBe(2);
    expect(body.totalPrice).toBe(100);
    expect(body.status).toBe("CONFIRMED");

    const eventResp = await app.inject({
      method: "GET",
      url: "/api/events/test-event-1",
    });
    expect(eventResp.json().availableTickets).toBe(98);
  });

  it("should reject duplicate booking with 409", async () => {
    const token = await getAccessToken(app);
    await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });
    expect(response.statusCode).toBe(409);
  });

  it("should reject oversell with 409", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-2", quantity: 2 },
    });
    expect(response.statusCode).toBe(409);
  });

  it("should return 404 for non-existent event", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "no-such-event", quantity: 1 },
    });
    expect(response.statusCode).toBe(404);
  });

  it("should reject unauthenticated request with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/bookings",
      payload: { eventId: "test-event-1", quantity: 1 },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("Bookings — GET /api/bookings", () => {
  it("should list current user's bookings", async () => {
    const token = await getAccessToken(app);
    await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 2 },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.eventId).toBe("test-event-1");
  });
});

describe("Bookings — PATCH /api/bookings/:id/cancel", () => {
  it("should cancel a booking and return tickets", async () => {
    const token = await getAccessToken(app);
    const createResp = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 3 },
    });
    const bookingId = createResp.json().id;

    const cancelResp = await app.inject({
      method: "PATCH",
      url: `/api/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cancelResp.statusCode).toBe(200);
    expect(cancelResp.json().status).toBe("CANCELLED");

    const eventResp = await app.inject({
      method: "GET",
      url: "/api/events/test-event-1",
    });
    expect(eventResp.json().availableTickets).toBe(100);
  });

  it("should return 404 for unknown booking", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "PATCH",
      url: "/api/bookings/non-existent/cancel",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("Bookings — GET /api/bookings/:id", () => {
  it("should return booking by id for the owner", async () => {
    const token = await getAccessToken(app);
    const createResp = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });
    const bookingId = createResp.json().id;

    const response = await app.inject({
      method: "GET",
      url: `/api/bookings/${bookingId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe(bookingId);
  });

  it("should return 404 for another user's booking", async () => {
    const token = await getAccessToken(app);
    const createResp = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });
    const bookingId = createResp.json().id;

    const registerResp = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "other@test.com", password: "other123", name: "Other" },
    });
    const otherId = registerResp.json().id;
    const otherLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "other@test.com", password: "other123" },
    });
    const otherToken = otherLogin.json().accessToken;

    const response = await app.inject({
      method: "GET",
      url: `/api/bookings/${bookingId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("Bookings — PATCH /api/bookings/:id/cancel (edge cases)", () => {
  it("should return 403 when cancelling another user's booking", async () => {
    const userToken = await getAccessToken(app);
    const createResp = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });
    const bookingId = createResp.json().id;

    const adminToken = await getAdminToken(app);
    const response = await app.inject({
      method: "PATCH",
      url: `/api/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("should return 400 when cancelling an already cancelled booking", async () => {
    const token = await getAccessToken(app);
    const createResp = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });
    const bookingId = createResp.json().id;

    await app.inject({
      method: "PATCH",
      url: `/api/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "PATCH",
      url: `/api/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("Bookings — GET /api/admin/bookings", () => {
  it("should list all bookings for admin", async () => {
    const userToken = await getAccessToken(app);
    await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });

    const adminToken = await getAdminToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/bookings",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.length).toBeGreaterThanOrEqual(1);
  });

  it("should reject non-admin user with 403", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/bookings",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it("should filter bookings by eventId for admin", async () => {
    const userToken = await getAccessToken(app);
    await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${userToken}` },
      payload: { eventId: "test-event-1", quantity: 1 },
    });

    const adminToken = await getAdminToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/bookings?eventId=test-event-1",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.every((b: any) => b.eventId === "test-event-1")).toBe(
      true,
    );
  });

  it("should filter bookings by status for admin", async () => {
    const adminToken = await getAdminToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/bookings?status=CONFIRMED",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.every((b: any) => b.status === "CONFIRMED")).toBe(true);
  });
});

describe("Admin — GET /api/admin/stats", () => {
  it("should return stats for admin", async () => {
    const adminToken = await getAdminToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("totalUsers");
    expect(body).toHaveProperty("totalEvents");
    expect(body).toHaveProperty("totalBookings");
    expect(body).toHaveProperty("totalRevenue");
  });

  it("should reject non-admin user with 403", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/stats",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(403);
  });
});
