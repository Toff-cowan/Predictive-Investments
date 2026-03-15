import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import { ModeToggle } from "./mode-toggle";

const SCROLL_THRESHOLD = 60;

export default function Header({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [hidden, setHidden] = useState(false);
  const lastScrollTop = useRef(0);

  const links = [
    { to: "/", label: "Dashboard" },
    { to: "/market", label: "Market & News" },
    { to: "/analytics", label: "Graphs & Analytics" },
    { to: "/lab", label: "Chat" },
  ] as const;

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
      className={`app-header fixed left-0 right-0 top-0 z-50 flex items-center justify-end gap-4 bg-transparent px-4 py-3 transition-transform duration-300 ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <nav className="flex items-center gap-4 text-lg">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `font-medium transition-colors hover:text-accent-foreground ${isActive ? "text-accent-foreground" : "text-foreground/80"}`
            }
            end
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-2">
        <ModeToggle />
      </div>
    </header>
  );
}
