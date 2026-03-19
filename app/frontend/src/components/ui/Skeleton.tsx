import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <Skeleton height={18} width="55%" style={{ marginBottom: 10 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={13} width={i === lines - 1 ? "70%" : "100%"} style={{ marginBottom: 8 }} />
      ))}
    </div>
  );
}

export function SkeletonTile() {
  return (
    <div className="tile">
      <Skeleton height={12} width="60%" style={{ marginBottom: 8 }} />
      <Skeleton height={28} width="80%" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <Skeleton width={36} height={36} borderRadius="50%" />
      <div style={{ flex: 1 }}>
        <Skeleton height={13} width="50%" style={{ marginBottom: 6 }} />
        <Skeleton height={11} width="35%" />
      </div>
      <Skeleton height={24} width={70} borderRadius={12} />
    </div>
  );
}
