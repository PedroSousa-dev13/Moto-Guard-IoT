import { useEffect, useRef, useState, memo } from "react";

interface LazyChartProps {
  children: React.ReactNode;
  height?: number;
}

/**
 * Only mounts children when the container enters the viewport.
 * Prevents off-screen Recharts from consuming CPU/memory.
 */
export const LazyChart = memo(function LazyChart({ children, height = 240 }: LazyChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect(); // mount once, never unmount
        }
      },
      { rootMargin: "200px" } // pre-load 200px before entering viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ minHeight: height }}>
      {visible ? children : null}
    </div>
  );
});
