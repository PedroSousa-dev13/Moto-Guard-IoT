// =============================================================================
// MotoGuard — TripCategoryBadge
// =============================================================================

import React from "react";
import { TripCategory } from "../../types/index";

export interface TripCategoryBadgeProps {
  category: TripCategory | null | undefined;
  confidence?: number | null;
}

const LABELS: Record<TripCategory, string> = {
  COMMUTE: "Urbana",
  WEEKEND_RIDE: "Passeio",
  TRACK_DAY: "Pista",
  OFF_ROAD: "Todo-o-Terreno",
};

const COLORS: Record<TripCategory, string> = {
  COMMUTE: "#3b82f6",
  WEEKEND_RIDE: "#22c55e",
  TRACK_DAY: "#f97316",
  OFF_ROAD: "#a16207",
};

export function TripCategoryBadge({ category, confidence }: TripCategoryBadgeProps) {
  if (category == null) return null;

  const isLowConfidence = confidence != null && confidence < 0.5;
  const color = COLORS[category];
  const label = LABELS[category];

  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    backgroundColor: color + "22",
    color: color,
    border: `1px solid ${color}55`,
    opacity: isLowConfidence ? 0.6 : 1,
  };

  return (
    <span style={style} title={isLowConfidence ? "Baixa confiança na classificação" : label}>
      {label}
      {isLowConfidence && <span aria-label="baixa confiança">?</span>}
    </span>
  );
}

export default TripCategoryBadge;
