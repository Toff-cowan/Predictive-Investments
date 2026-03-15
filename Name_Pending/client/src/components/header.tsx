import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Newspaper,
  LineChart,
  MessageCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@pi/ui/components/button";
import { ModeToggle } from "./mode-toggle";
import { trpc } from "@/utils/trpc";
import { logout } from "@/utils/auth";

const SCROLL_THRESHOLD = 60;

const links: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/market", label: "Market & News", icon: Newspaper },
  { to: "/analytics", label: "Graphs & Analytics", icon: LineChart },
  { to: "/lab", label: "Chat", icon: MessageCircle },
];

export default function Header({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [hidden, setHidden] = useState(false);
  const lastScrollTop = useRef(0);
  const { data: user } = useQuery(trpc.auth.me.queryOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    await queryClient.invalidateQueries(trpc.auth.me.queryOptions());
    navigate("/", { replace: true });
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const top = el.scrollTop;
      if (top > SCROLL_THRESHOLD) {
        setHidden(top > lastScrollTop.current);
      } else {
        setHidden(false);
      }
      lastScrollTop.current = top;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  return (
    <header
      className={`app-header fixed left-0 right-0 top-0 z-50 flex items-center justify-between gap-2 bg-transparent px-4 py-3 transition-transform duration-300 sm:gap-4 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="flex items-center">
        {!user ? (
          <NavLink
            to="/login"
            className="rounded-md p-2 text-lg font-medium text-foreground/80 transition-colors hover:text-accent-foreground md:px-2"
          >
            Log in
          </NavLink>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 text-lg font-medium text-foreground/80 hover:text-accent-foreground md:px-2"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 text-lg sm:gap-4">
        <nav className="flex items-center gap-2 sm:gap-4">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-md p-2 font-medium transition-colors hover:text-accent-foreground md:p-1.5 md:px-2 ${isActive ? "text-accent-foreground" : "text-foreground/80"}`
              }
              end
            >
              <Icon className="h-5 w-5 shrink-0 md:mr-1" aria-hidden />
              <span className="hidden md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        {user ? (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.email}
          </span>
        ) : null}
        <ModeToggle />
      </div>
    </header>
  );
}
