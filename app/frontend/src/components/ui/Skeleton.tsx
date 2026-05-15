interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className="bg-surface-3 animate-pulse"
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-surface/60 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-sm">
      <Skeleton height={18} width="55%" style={{ marginBottom: 10 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? "70%" : "100%"} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export function SkeletonTile() {
  return (
    <div className="bg-surface/60 backdrop-blur-md border border-white/10 rounded-xl p-5 shadow-sm">
      <Skeleton height={12} width="60%" style={{ marginBottom: 8 }} />
      <Skeleton height={28} width="80%" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5">
      <Skeleton width={36} height={36} borderRadius="50%" />
      <div className="flex-1">
        <Skeleton height={13} width="50%" style={{ marginBottom: 6 }} />
        <Skeleton height={11} width="35%" />
      </div>
      <Skeleton height={24} width={70} borderRadius={12} />
    </div>
  );
}
