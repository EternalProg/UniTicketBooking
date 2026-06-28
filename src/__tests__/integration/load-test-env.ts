import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const envFilePath = path.join(repoRoot, ".env.test");

const result = dotenv.config({ path: envFilePath, override: true, quiet: true });

if (result.error) {
  throw new Error(
    `Integration tests require ${envFilePath}. Create it from .env.test.example.`,
  );
}

process.env["NODE_ENV"] ??= "test";

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl) {
  throw new Error("Integration tests require DATABASE_URL in .env.test.");
}

const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");

if (!databaseName.endsWith("_test")) {
  throw new Error(
    `Refusing to run integration tests against non-test database \"${databaseName}\". Use a database name ending with _test.`,
  );
}
