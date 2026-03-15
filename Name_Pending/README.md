# PI — Predictive Investments

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, React Router, Express, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **React Router** - Declarative routing for React
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Express** - Fast, unopinionated web framework
- **tRPC** - End-to-end type-safe APIs
- **Node.js** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
npm install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
npm run db:push
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to see the web application.

### Deploying to Render (fixing signup/login 500)

If `POST /auth/signup` or `/auth/login` returns **500** on Render, the usual cause is the production database is missing the auth tables or `DATABASE_URL` is not set.

1. **Set `DATABASE_URL`**  
   In Render: your **Web Service** → **Environment** → add `DATABASE_URL` with your Postgres connection string (e.g. from a Render Postgres instance: **Internal Database URL** or **External**).

2. **Create auth tables in that database**  
   From your machine (with the same `DATABASE_URL` as production), run:
   ```bash
   # Use the production DB URL, e.g. from Render dashboard
   set DATABASE_URL=<your-render-postgres-url>
   npm run db:push
   ```
   Or put `DATABASE_URL` in `server/.env` temporarily and run `npm run db:push` from the repo root.

3. **Check logs**  
   After redeploying, the server logs either **"Database OK (auth tables ready)"** or **"Database check failed — ..."**. On signup error, the log line **"[auth] signup error: ..."** shows the exact cause (e.g. missing table, connection refused).
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `client/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@pi/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `client`.

## Project Structure

```
pi/
├── client/          # Frontend application (React + React Router)
├── server/          # Backend API (Express, TRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `npm run dev`: Start all applications in development mode
- `npm run build`: Build all applications
- `npm run dev:web`: Start only the web application
- `npm run dev:server`: Start only the server
- `npm run check-types`: Check TypeScript types across all apps
- `npm run db:push`: Push schema changes to database
- `npm run db:generate`: Generate database client/types
- `npm run db:migrate`: Run database migrations
- `npm run db:studio`: Open database studio UI
