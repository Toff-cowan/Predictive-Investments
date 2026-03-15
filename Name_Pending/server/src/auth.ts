/**
 * REST auth routes: signup, login, logout.
 * Sets HTTP-only cookie for session. All app features remain available without logging in.
 */
import { db } from "@pi/db";
import { sessions, users } from "@pi/db/schema";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "session_token";
const SESSION_DAYS = 7;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}.${hash.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(".");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hash = scryptSync(password, salt, 64);
  const storedHash = Buffer.from(hashHex, "hex");
  return timingSafeEqual(hash, storedHash);
}

function setSessionCookie(res: Response, token: string) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60 * 1000;
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  });
}

type AuthBody = { email?: string; password?: string };

export async function handleSignup(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as AuthBody;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashPassword(password),
      })
      .returning({ id: users.id, email: users.email, createdAt: users.createdAt });
    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });
    setSessionCookie(res, token);
    res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("[auth] signup error:", err);
    res.status(500).json({ error: "Sign up failed" });
  }
}

export async function handleLogin(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as AuthBody;
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
      columns: { id: true, email: true, passwordHash: true },
    });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
    });
    setSessionCookie(res, token);
    res.status(200).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
}

export async function handleLogout(req: Request, res: Response) {
  const token = (req as { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.status(200).json({ ok: true });
}
