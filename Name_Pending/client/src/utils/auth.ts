import { env } from "@pi/env/web";

const BASE = env.VITE_SERVER_URL;

export type AuthUser = { id: string; email: string };

export async function signup(
  email: string,
  password: string
): Promise<{ user: AuthUser } | { error: string }> {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { user?: AuthUser; error?: string };
  if (!res.ok) return { error: data.error ?? "Sign up failed" };
  if (!data.user) return { error: "Sign up failed" };
  return { user: data.user };
}

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser } | { error: string }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as { user?: AuthUser; error?: string };
  if (!res.ok) return { error: data.error ?? "Login failed" };
  if (!data.user) return { error: "Login failed" };
  return { user: data.user };
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}
