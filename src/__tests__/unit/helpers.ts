import type { FastifyInstance } from "fastify";

export async function getAccessToken(
  app: FastifyInstance,
  email: string = "user@test.com",
  password: string = "user123",
): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  const body = response.json();
  if (response.statusCode !== 200) {
    throw new Error(`Login failed: ${body.message}`);
  }
  return body.accessToken as string;
}

export async function getAdminToken(app: FastifyInstance): Promise<string> {
  return getAccessToken(app, "admin@test.com", "admin123");
}
