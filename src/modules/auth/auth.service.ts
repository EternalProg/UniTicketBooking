import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import type { AuthServiceContract, TokenBlacklist } from "../../app-contracts.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt.js";

export class AuthService implements AuthServiceContract {
  constructor(private tokenBlacklist: TokenBlacklist) {}

  async register(data: { email: string; password: string; name: string }) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictError("Email already in use");
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        name: data.name,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return user;
  }

  async login(data: { email: string; password: string }) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await bcrypt.compare(data.password, user.password);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const jti = crypto.randomUUID();
    const accessToken = generateAccessToken({
      id: user.id,
      role: user.role,
      jti,
    });
    const refreshToken = generateRefreshToken({ id: user.id, jti });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true },
      });
      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      const jti = crypto.randomUUID();
      const accessToken = generateAccessToken({
        id: user.id,
        role: user.role,
        jti,
      });

      return { accessToken };
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
  }

  async logout(jti: string, ttlSeconds: number): Promise<void> {
    await this.tokenBlacklist.blacklist(jti, ttlSeconds);
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    if (!user) {
      throw new UnauthorizedError("User not found");
    }
    return { ...user, createdAt: user.createdAt.toISOString() };
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
