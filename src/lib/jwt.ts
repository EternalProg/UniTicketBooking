import { createSigner, createVerifier } from "fast-jwt";
import { env } from "../config/env.js";

const accessSigner = createSigner({
  key: env.JWT_ACCESS_SECRET,
  expiresIn: env.JWT_ACCESS_EXPIRES_IN,
});

const refreshSigner = createSigner({
  key: env.JWT_REFRESH_SECRET,
  expiresIn: env.JWT_REFRESH_EXPIRES_IN,
});

const refreshVerifier = createVerifier({
  key: env.JWT_REFRESH_SECRET,
});

export function generateAccessToken(payload: { id: string; role: string; jti: string }): string {
  return accessSigner(payload);
}

export function generateRefreshToken(payload: { id: string; jti: string }): string {
  return refreshSigner(payload);
}

export function verifyRefreshToken(token: string): { id: string; jti: string } {
  return refreshVerifier(token) as { id: string; jti: string };
}


