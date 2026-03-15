import { createContext } from "@pi/api/context";
import { getCsvPathByRelativePath, getPredictedCsvPath } from "@pi/api/routers/index";
import { appRouter } from "@pi/api/routers/index";
import { env } from "@pi/env/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { handleLogin, handleLogout, handleSignup } from "./auth";

const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
if (allowedOrigins.length === 0) allowedOrigins.push("http://localhost:5173");
app.use(
  cors({
    origin: (origin, cb) => {
      if (origin == null) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (allowedOrigins.some((o) => o.includes(".vercel.app")) && origin.endsWith(".vercel.app")) return cb(null, true);
      cb(null, false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

/** Auth: signup, login, logout (session cookie). Features work without logging in. */
app.post("/auth/signup", handleSignup);
app.post("/auth/login", handleLogin);
app.post("/auth/logout", handleLogout);

app.get("/", (_req, res) => {
  res.status(200).send("OK");
});

/** Serve predicted CSV for a symbol. URI: GET /api/predicted-csv/:symbol */
app.get("/api/predicted-csv/:symbol", (req, res) => {
  const symbol = (req.params.symbol ?? "").replace(/[^A-Z0-9\-]/gi, "").toUpperCase();
  if (!symbol) {
    res.status(400).send("Missing or invalid symbol");
    return;
  }
  const filePath = getPredictedCsvPath(symbol);
  if (!fs.existsSync(filePath)) {
    res.status(404).send("Predicted CSV not found. Run Analyze for this symbol first.");
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${symbol}_predicted.csv"`);
  res.sendFile(path.resolve(filePath));
});

/**
 * Serve any CSV under the output dir by relative path. Use so the website can fetch CSV data by path.
 * URI: GET /api/csv?path=AAPL/predicted.csv (path = relative path under yahoo_top_100_output)
 */
app.get("/api/csv", (req, res) => {
  const relativePath = (req.query.path ?? "") as string;
  if (!relativePath.trim()) {
    res.status(400).send("Missing query parameter: path (e.g. path=AAPL/predicted.csv)");
    return;
  }
  const filePath = getCsvPathByRelativePath(relativePath.trim());
  if (!filePath) {
    res.status(400).send("Invalid path. Use a path like AAPL/predicted.csv (no '..' or special chars).");
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.status(404).send("CSV not found at that path.");
    return;
  }
  const filename = path.basename(filePath);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.sendFile(path.resolve(filePath));
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
