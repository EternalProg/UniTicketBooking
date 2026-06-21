import { z } from "zod";

export function toJsonSchema(zod: z.ZodType) {
  return z.toJSONSchema(zod, { target: "openapi-3.0" }) as Record<string, unknown>;
}
