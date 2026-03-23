// Feature: trip-categorization
// Properties 7 and 8 — TripCategoryBadge PBT
// Unit tests — Task 11.4

import React from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import * as fc from "fast-check";
import { TripCategoryBadge } from "./TripCategoryBadge";

afterEach(() => {
  cleanup();
});

const VALID_CATEGORIES = ["COMMUTE", "WEEKEND_RIDE", "TRACK_DAY", "OFF_ROAD"] as const;

const LABELS: Record<(typeof VALID_CATEGORIES)[number], string> = {
  COMMUTE: "Urbana",
  WEEKEND_RIDE: "Passeio",
  TRACK_DAY: "Pista",
  OFF_ROAD: "Todo-o-Terreno",
};

// jsdom converts hex colors to rgb() format when reading element.style.color
const COLORS: Record<(typeof VALID_CATEGORIES)[number], string> = {
  COMMUTE: "rgb(59, 130, 246)",
  WEEKEND_RIDE: "rgb(34, 197, 94)",
  TRACK_DAY: "rgb(249, 115, 22)",
  OFF_ROAD: "rgb(161, 98, 7)",
};

describe("TripCategoryBadge — property-based tests", () => {
  // Feature: trip-categorization, Property 7: badge renderiza rótulo e cor corretos para cada categoria
  it("Property 7: badge renderiza rótulo e cor corretos para cada categoria", () => {
    fc.assert(
      fc.property(fc.constantFrom(...VALID_CATEGORIES), (category) => {
        const { container } = render(<TripCategoryBadge category={category} />);
        const badge = container.querySelector("span");
        expect(badge).not.toBeNull();
        expect(badge!.textContent).toContain(LABELS[category]);
        expect(badge!.style.color).toBe(COLORS[category]);
        cleanup();
        return true;
      })
    );
  });

  // Feature: trip-categorization, Property 8: badge de baixa confiança aplica estilo visual distinto
  it("Property 8: badge de baixa confiança aplica estilo visual distinto", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_CATEGORIES),
        fc.float({ min: 0, max: Math.fround(0.49) }),
        (category, confidence) => {
          const { container } = render(
            <TripCategoryBadge category={category} confidence={confidence} />
          );
          const badge = container.querySelector("span");
          expect(badge).not.toBeNull();
          // Low confidence: opacity should be reduced (0.6) and "?" should be present
          expect(badge!.style.opacity).toBe("0.6");
          expect(badge!.textContent).toContain("?");
          cleanup();
          return true;
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — Task 11.4
// ---------------------------------------------------------------------------

describe("TripCategoryBadge — unit tests", () => {
  // 11.4: category = null → não renderiza nada (retorna null)
  it("11.4: não renderiza nada quando category é null", () => {
    const { container } = render(<TripCategoryBadge category={null} />);
    expect(container.firstChild).toBeNull();
  });
});
