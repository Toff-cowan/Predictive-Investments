import { createContext } from "@Name_Pending/api/context";
import { getCsvPathByRelativePath, getPredictedCsvPath } from "@Name_Pending/api/routers/index";
import { appRouter } from "@Name_Pending/api/routers/index";
import { env } from "@Name_Pending/env/server";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  }),
);

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.use(express.json());

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

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
