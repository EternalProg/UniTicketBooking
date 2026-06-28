import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { env } from "../config/env.js";

function buildAdapter(): PrismaMariaDb {
  const url = new URL(env.DATABASE_URL);
  const dbName = url.pathname.replace(/^\//, "");

  return new PrismaMariaDb(
    {
      host: url.hostname,
      port: Number(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: dbName,
      connectionLimit: 5,
      connectTimeout: 10_000,
      acquireTimeout: 20_000,
    },
    { database: dbName },
  );
}

const adapter = buildAdapter();
export const prisma = new PrismaClient({ adapter });
