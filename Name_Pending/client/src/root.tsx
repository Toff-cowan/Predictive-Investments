import { Toaster } from "@Name_Pending/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";

import "./index.css";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useRef } from "react";

import type { Route } from "./+types/root";
import BackToTop from "./components/back-to-top";
import Header from "./components/header";
import { ThemeProvider } from "./components/theme-provider";
import { queryClient } from "./utils/trpc";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const mainScrollRef = useRef<HTMLDivElement>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        <div className="grid h-svh w-full grid-rows-[0_1fr] overflow-hidden">
          <div className="relative min-h-0">
            <Header scrollRef={mainScrollRef} />
          </div>
          <main ref={mainScrollRef} className="min-h-0 overflow-auto bg-background pt-14">
            <Outlet />
          </main>
          <BackToTop scrollRef={mainScrollRef} />
        </div>
        <Toaster richColors />
      </ThemeProvider>
      <ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
    </QueryClientProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }
  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
