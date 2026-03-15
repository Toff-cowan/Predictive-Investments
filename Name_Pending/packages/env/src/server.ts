import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const corsOriginSchema = z
  .string()
  .default("http://localhost:5173")
  .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean));

export const env = createEnv({
  server: {
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgresql://localhost:5432/name_pending"),
    /** Comma-separated list of allowed origins, e.g. "https://app.vercel.app,https://*.vercel.app" or a single URL */
    CORS_ORIGIN: corsOriginSchema,
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
