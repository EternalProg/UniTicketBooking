import { describe, it, expect } from "vitest";
import { app } from "./setup.js";
import { getAccessToken, getAdminToken } from "./helpers.js";

describe("Integration smoke", () => {
  it("should report healthy infrastructure", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().checks.database).toBe("ok");
  });

  it("should register and login against real services", async () => {
    const registerResponse = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "new@test.com", password: "secret123", name: "New" },
    });
    expect(registerResponse.statusCode).toBe(201);

    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "new@test.com", password: "secret123" },
    });
    expect(loginResponse.statusCode).toBe(200);
    expect(loginResponse.json()).toHaveProperty("accessToken");
  });

  it("should blacklist a token on logout", async () => {
    const token = await getAccessToken(app);

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(logoutResponse.statusCode).toBe(200);

    const meResponse = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meResponse.statusCode).toBe(401);
    expect(meResponse.json().message).toBe("Token has been revoked");
  });

  it("should create and update an event as admin", async () => {
    const token = await getAdminToken(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "New Event",
        description: "New desc",
        date: "2026-08-01T18:00:00Z",
        location: "New Loc",
        totalTickets: 50,
        price: 25,
        category: "Music",
      },
    });
    expect(createResponse.statusCode).toBe(201);

    const eventId = createResponse.json().id;
    const updateResponse = await app.inject({
      method: "PUT",
      url: `/api/events/${eventId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Updated Title" },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().title).toBe("Updated Title");
  });

  it("should create and cancel a booking transactionally", async () => {
    const token = await getAccessToken(app);

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { authorization: `Bearer ${token}` },
      payload: { eventId: "test-event-1", quantity: 2 },
    });
    expect(createResponse.statusCode).toBe(201);

    const bookingId = createResponse.json().id;
    const cancelResponse = await app.inject({
      method: "PATCH",
      url: `/api/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json().status).toBe("CANCELLED");
  });
});
