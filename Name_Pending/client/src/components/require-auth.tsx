import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { trpc } from "@/utils/trpc";

/**
 * Wraps content that requires login. If not logged in, redirects to /login with return URL.
 * Homepage, login, and signup are not wrapped and stay public.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user, isLoading } = useQuery(trpc.auth.me.queryOptions());

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/login", { state: { from: location.pathname }, replace: true });
    }
  }, [user, isLoading, navigate, location.pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
