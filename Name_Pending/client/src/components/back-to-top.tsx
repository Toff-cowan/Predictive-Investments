import { ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 300;

type BackToTopProps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

export default function BackToTop({ scrollRef }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setVisible(el.scrollTop > SCROLL_THRESHOLD);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => el.removeEventListener("scroll", handleScroll);
  }, [scrollRef]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      className="back-to-top"
      aria-label="Back to top"
      title="Back to top"
    >
      <ChevronUp className="size-5" />
    </button>
  );
}
