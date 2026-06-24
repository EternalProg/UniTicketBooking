import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

const mockJwt = vi.hoisted(() => ({
  generateAccessToken: vi.fn(() => "mock-access-token"),
  generateRefreshToken: vi.fn(() => "mock-refresh-token"),
  verifyRefreshToken: vi.fn(),
}));

vi.mock("../../lib/jwt.js", () => mockJwt);

import {
  AuthService,
  ConflictError,
  UnauthorizedError,
} from "../../modules/auth/auth.service.js";
import bcrypt from "bcryptjs";

const mockBlacklist = {
  blacklist: vi.fn(),
  isBlacklisted: vi.fn(),
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(mockBlacklist);
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("hashed-password");
      mockPrismaUser.create.mockResolvedValue({
        id: "user-1",
        email: "new@test.com",
        name: "New",
        role: "USER",
      });

      const result = await service.register({
        email: "new@test.com",
        password: "secret123",
        name: "New",
      });

      expect(result).toEqual({
        id: "user-1",
        email: "new@test.com",
        name: "New",
        role: "USER",
      });
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { email: "new@test.com" },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 12);
      expect(mockPrismaUser.create).toHaveBeenCalledWith({
        data: { email: "new@test.com", password: "hashed-password", name: "New" },
        select: { id: true, email: true, name: true, role: true },
      });
    });

    it("should throw ConflictError on duplicate email", async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "existing",
        email: "dup@test.com",
      });

      await expect(
        service.register({ email: "dup@test.com", password: "secret", name: "Dup" }),
      ).rejects.toThrow(ConflictError);
      expect(mockPrismaUser.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@test.com",
        name: "User",
        role: "USER",
        password: "hashed-password",
      });
      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await service.login({ email: "user@test.com", password: "user123" });

      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        user: { id: "user-1", email: "user@test.com", name: "User", role: "USER" },
      });
    });

    it("should throw UnauthorizedError on wrong password", async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@test.com",
        password: "hashed-password",
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        service.login({ email: "user@test.com", password: "wrong" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError on non-existent user", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: "nobody@test.com", password: "x" }),
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("refreshToken", () => {
    it("should return a new access token", async () => {
      mockJwt.verifyRefreshToken.mockReturnValue({ id: "user-1", jti: "old-jti" });
      mockPrismaUser.findUnique.mockResolvedValue({ id: "user-1", role: "USER" });
      mockJwt.generateAccessToken.mockReturnValue("new-access-token");

      const result = await service.refreshToken("valid-refresh-token");
      expect(result).toEqual({ accessToken: "new-access-token" });
    });

    it("should throw UnauthorizedError on invalid refresh token", async () => {
      mockJwt.verifyRefreshToken.mockImplementation(() => {
        throw new Error("bad");
      });
      await expect(service.refreshToken("bad")).rejects.toThrow(UnauthorizedError);
    });

    it("should throw UnauthorizedError when user not found", async () => {
      mockJwt.verifyRefreshToken.mockReturnValue({ id: "missing", jti: "jti" });
      mockPrismaUser.findUnique.mockResolvedValue(null);
      await expect(service.refreshToken("token")).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("logout", () => {
    it("should blacklist the token", async () => {
      await service.logout("test-jti", 3600);
      expect(mockBlacklist.blacklist).toHaveBeenCalledWith("test-jti", 3600);
    });
  });

  describe("getMe", () => {
    it("should return user profile", async () => {
      const createdAt = new Date("2026-01-01T00:00:00Z");
      mockPrismaUser.findUnique.mockResolvedValue({
        id: "user-1",
        email: "user@test.com",
        name: "User",
        role: "USER",
        createdAt,
      });

      const result = await service.getMe("user-1");
      expect(result).toEqual({
        id: "user-1",
        email: "user@test.com",
        name: "User",
        role: "USER",
        createdAt: createdAt.toISOString(),
      });
    });

    it("should throw UnauthorizedError when user not found", async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);
      await expect(service.getMe("nobody")).rejects.toThrow(UnauthorizedError);
    });
  });
});
