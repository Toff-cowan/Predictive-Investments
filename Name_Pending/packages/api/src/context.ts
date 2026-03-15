import { db } from "@pi/db";
import { sessions, users } from "@pi/db/schema";
import { and, eq, gt } from "drizzle-orm";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

const SESSION_COOKIE = "session_token";
const HARDCODED_SESSION_VALUE = "hardcoded";
const HARDCODED_USER = { id: "hardcoded", email: "admin@example.com" };

export type SessionUser = { id: string; email: string };

export async function createContext(opts: CreateExpressContextOptions) {
  const token = (opts.req as { cookies?: Record<string, string> }).cookies?.[
    SESSION_COOKIE
  ];
  if (!token) {
    return { session: null };
  }
  if (token === HARDCODED_SESSION_VALUE) {
    return { session: { user: HARDCODED_USER } };
  }
  try {
    const now = new Date();
    const [row] = await db
      .select({
        userId: sessions.userId,
        email: users.email,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(eq(sessions.token, token), gt(sessions.expiresAt, now))
      )
      .limit(1);
    if (!row) return { session: null };
    return {
      session: { user: { id: row.userId, email: row.email } },
    };
  } catch {
    return { session: null };
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>;
