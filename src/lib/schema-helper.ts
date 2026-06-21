import { z } from "zod";

export function toJsonSchema(zod: z.ZodType) {
  return z.toJSONSchema(zod, { target: "draft-07" }) as Record<string, unknown>;
}
