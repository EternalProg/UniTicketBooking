import { describe, it, expect } from "vitest";
import { app } from "./setup.js";
import { createOptionalAuth } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

describe("Auth — POST /api/auth/register", () => {
  it("should register a new user and return 201", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "new@test.com", password: "secret123", name: "New" },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty("id");
    expect(body.email).toBe("new@test.com");
    expect(body.role).toBe("USER");
  });

  it("should reject duplicate email with 409", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "user@test.com", password: "secret123", name: "Dup" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toBe("Conflict");
  });

  it("should reject invalid email with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "bad", password: "secret123", name: "Bad" },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("Auth — POST /api/auth/login", () => {
  it("should login with valid credentials and return tokens", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@test.com", password: "user123" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveProperty("accessToken");
    expect(body).toHaveProperty("refreshToken");
    expect(body.user.email).toBe("user@test.com");
  });

  it("should reject wrong password with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@test.com", password: "wrong" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe("Unauthorized");
  });
});

describe("Auth — POST /api/auth/refresh", () => {
  it("should return a new access token", async () => {
    const loginResp = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@test.com", password: "user123" },
    });
    const { refreshToken } = loginResp.json();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("accessToken");
  });

  it("should reject invalid refresh token with 401", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      payload: { refreshToken: "invalid-token" },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("Auth — POST /api/auth/logout", () => {
  it("should logout successfully", async () => {
    const token = await getAccessTokenFromLogin();

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().message).toBe("Logged out successfully");
  });

  it("should blacklist token so /auth/me returns 401", async () => {
    const token = await getAccessTokenFromLogin();

    await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${token}` },
    });

    const meResp = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(meResp.statusCode).toBe(401);
    expect(meResp.json().message).toBe("Token has been revoked");
  });
});

describe("Auth — GET /api/auth/me", () => {
  it("should return current user profile", async () => {
    const loginResp = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "user@test.com", password: "user123" },
    });
    const token = loginResp.json().accessToken;

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().email).toBe("user@test.com");
  });

  it("should return 401 without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });
    expect(response.statusCode).toBe(401);
  });
});

let cachedToken: string | null = null;

async function getAccessTokenFromLogin(): Promise<string> {
  if (cachedToken) return cachedToken;
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "user@test.com", password: "user123" },
  });
  cachedToken = response.json().accessToken as string;
  return cachedToken;
}

describe("createOptionalAuth middleware", () => {
  it("should set user when valid token is provided", async () => {
    const tokenBlacklist = {
      blacklist: async () => {},
      isBlacklisted: async () => false,
    };

    const optionalAuth = createOptionalAuth(tokenBlacklist);

    const user = { id: "test-id", role: "USER", jti: "test-jti" };
    const request = {
      jwtVerify: async () => {
        (request as any).user = user;
      },
      user: undefined as any,
    };
    const reply = { status: () => reply, send: () => {} };

    await optionalAuth(request as any, reply as any);

    expect(request.user).toBe(user);
  });

  it("should clear user when token is blacklisted", async () => {
    const tokenBlacklist = {
      blacklist: async () => {},
      isBlacklisted: async () => true,
    };

    const optionalAuth = createOptionalAuth(tokenBlacklist);

    const request = {
      jwtVerify: async () => {
        (request as any).user = { id: "test-id", role: "USER", jti: "blacklisted-jti" };
      },
      user: undefined as any,
    };
    const reply = { status: () => reply, send: () => {} };

    await optionalAuth(request as any, reply as any);

    expect(request.user).toBeUndefined();
  });

  it("should not fail when no token is provided", async () => {
    const tokenBlacklist = {
      blacklist: async () => {},
      isBlacklisted: async () => false,
    };

    const optionalAuth = createOptionalAuth(tokenBlacklist);

    const request = {
      jwtVerify: async () => {
        throw new Error("No token");
      },
      user: undefined as any,
    };
    const reply = { status: () => reply, send: () => {} };

    await expect(optionalAuth(request as any, reply as any)).resolves.toBeUndefined();
  });
});

describe("authorize middleware", () => {
  it("should return 401 when no user is present", async () => {
    let statusCode = 0;
    let sentBody: any = null;
    const request = { user: undefined };
    const reply = {
      status: (code: number) => {
        statusCode = code;
        return reply;
      },
      send: (body: any) => {
        sentBody = body;
      },
    };

    const handler = authorize("ADMIN");
    await handler(request as any, reply as any);

    expect(statusCode).toBe(401);
    expect(sentBody).toEqual({
      statusCode: 401,
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("should return 403 when user role is not allowed", async () => {
    let statusCode = 0;
    let sentBody: any = null;
    const request = { user: { role: "USER" } };
    const reply = {
      status: (code: number) => {
        statusCode = code;
        return reply;
      },
      send: (body: any) => {
        sentBody = body;
      },
    };

    const handler = authorize("ADMIN");
    await handler(request as any, reply as any);

    expect(statusCode).toBe(403);
    expect(sentBody).toEqual({
      statusCode: 403,
      error: "Forbidden",
      message: "Insufficient permissions",
    });
  });

  it("should pass when user role is allowed", async () => {
    let called = false;
    const request = { user: { role: "ADMIN" } };
    const reply = {
      status: () => reply,
      send: () => {
        called = true;
      },
    };

    const handler = authorize("ADMIN");
    await handler(request as any, reply as any);

    expect(called).toBe(false);
  });
});
