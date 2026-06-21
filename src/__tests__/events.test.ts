import { describe, it, expect } from "vitest";
import { app } from "./setup.js";
import { getAccessToken, getAdminToken } from "./helpers.js";

describe("Events — GET /api/events", () => {
  it("should list events with pagination", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/events",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it("should respect page and limit params", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/events?page=1&limit=1",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.totalPages).toBe(2);
  });

  it("should filter by category", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/events?category=Music",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.title).toContain("Test Event 1");
  });

  it("should search by title", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/events?search=Event+2",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.title).toBe("Test Event 2");
  });
});

describe("Events — GET /api/events/:id", () => {
  it("should return event by id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/events/test-event-1",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe("Test Event 1");
  });

  it("should return 404 for unknown id", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/events/non-existent",
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("Events — POST /api/events (admin)", () => {
  it("should create event as admin and return 201", async () => {
    const token = await getAdminToken(app);
    const response = await app.inject({
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
    expect(response.statusCode).toBe(201);
    expect(response.json().title).toBe("New Event");
  });

  it("should reject creation by regular user with 403", async () => {
    const token = await getAccessToken(app);
    const response = await app.inject({
      method: "POST",
      url: "/api/events",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: "Hack",
        description: "Hack desc",
        date: "2026-08-01T18:00:00Z",
        location: "Hack Loc",
        totalTickets: 10,
        price: 0,
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it("should reject unauthenticated request with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/events",
      payload: {
        title: "Hack",
        description: "Hack desc",
        date: "2026-08-01T18:00:00Z",
        location: "Hack Loc",
        totalTickets: 10,
        price: 0,
      },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("Events — PUT /api/events/:id (admin)", () => {
  it("should update event as admin", async () => {
    const token = await getAdminToken(app);
    const response = await app.inject({
      method: "PUT",
      url: "/api/events/test-event-1",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Updated Title" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().title).toBe("Updated Title");
  });

  it("should return 404 for unknown event", async () => {
    const token = await getAdminToken(app);
    const response = await app.inject({
      method: "PUT",
      url: "/api/events/non-existent",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Nope" },
    });
    expect(response.statusCode).toBe(404);
  });
});

describe("Events — DELETE /api/events/:id (admin)", () => {
  it("should delete event as admin", async () => {
    const token = await getAdminToken(app);
    const response = await app.inject({
      method: "DELETE",
      url: "/api/events/test-event-1",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Event deleted");
  });

  it("should return 404 for unknown event", async () => {
    const token = await getAdminToken(app);
    const response = await app.inject({
      method: "DELETE",
      url: "/api/events/non-existent",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(404);
  });
});
