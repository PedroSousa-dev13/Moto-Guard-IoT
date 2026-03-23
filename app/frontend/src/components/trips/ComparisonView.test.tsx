// =============================================================================
// MotoGuard — ComparisonView Unit Tests
// Validates: Requirements 2.4, 3.3, 3.4, 5.4, 6.5
// =============================================================================

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ComparisonView } from "./ComparisonView";
import type { Trip, TripTelemetryResponse, TripEvaluationResponse } from "../../types";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../services/api", () => ({
  tripsAPI: {
    getTelemetry: vi.fn(),
    getEvaluation: vi.fn(),
  },
}));

vi.mock("./OverlaySpeedChart", () => ({
  OverlaySpeedChart: () => <div data-testid="overlay-speed-chart">Chart</div>,
}));

import { tripsAPI } from "../../services/api";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeTrip(id: string, overrides: Partial<Trip> = {}): Trip {
  return {
    id,
    userId: "user-1",
    motorcycleId: "moto-1",
    source: "GPX_IMPORTED",
    startedAt: "2024-01-15T10:00:00Z",
    endedAt: "2024-01-15T11:00:00Z",
    distanceKm: 50,
    avgSpeedKmh: 60,
    maxSpeedKmh: 120,
    status: "COMPLETED",
    createdAt: "2024-01-15T10:00:00Z",
    motorcycle: { id: "moto-1", name: "Bandit 650", brand: "Suzuki" },
    ...overrides,
  };
}

function makeTelemetryResponse(points = 3): TripTelemetryResponse {
  return {
    trip: { id: "trip-1", startedAt: "2024-01-15T10:00:00Z", endedAt: "2024-01-15T11:00:00Z", status: "COMPLETED" },
    total_points: points,
    data: Array.from({ length: points }, (_, i) => ({
      time: `2024-01-15T10:0${i}:00Z`,
      speed_kmh: 60 + i * 5,
    })),
  };
}

function makeEvaluationResponse(overrides: Partial<TripEvaluationResponse> = {}): TripEvaluationResponse {
  return {
    score: 85,
    model: "heuristic-v1",
    mlScore: 78,
    mlFeedback: "Good",
    comparisonReport: null,
    severityCounts: { INFO: 2, WARNING: 1, CRITICAL: 0 },
    typeCounts: { HARD_BRAKING: 1, SPEEDING: 2 },
    penalties: [],
    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks(
  telemetryResult: "resolve" | "reject" = "resolve",
  evaluationResult: "resolve" | "reject" = "resolve",
  telemetryData?: TripTelemetryResponse,
  evaluationData?: TripEvaluationResponse
) {
  const mockGetTelemetry = vi.mocked(tripsAPI.getTelemetry);
  const mockGetEvaluation = vi.mocked(tripsAPI.getEvaluation);

  if (telemetryResult === "resolve") {
    mockGetTelemetry.mockResolvedValue({ data: telemetryData ?? makeTelemetryResponse() } as any);
  } else {
    mockGetTelemetry.mockRejectedValue(new Error("Telemetry error"));
  }

  if (evaluationResult === "resolve") {
    mockGetEvaluation.mockResolvedValue({ data: evaluationData ?? makeEvaluationResponse() } as any);
  } else {
    mockGetEvaluation.mockRejectedValue(new Error("Evaluation error"));
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ComparisonView — fatal error (Requirement 2.4)", () => {
  it("shows fatal error when trips are not found in the trips array", () => {
    render(
      <ComparisonView
        tripIds={["missing-1", "missing-2"]}
        trips={[]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/não foram encontradas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fechar/i })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked in fatal error state", () => {
    const onClose = vi.fn();
    render(
      <ComparisonView
        tripIds={["missing-1", "missing-2"]}
        trips={[]}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ComparisonView — initial rendering", () => {
  it("renders the overlay dialog with aria attributes", async () => {
    setupMocks();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("shows motorcycle names in the header", async () => {
    setupMocks();
    const trips = [
      makeTrip("trip-a", { motorcycle: { id: "m1", name: "Bandit 650", brand: "Suzuki" } }),
      makeTrip("trip-b", { id: "trip-b", motorcycle: { id: "m2", name: "CBR 600", brand: "Honda" } }),
    ];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByText("Bandit 650")).toBeInTheDocument();
    expect(screen.getByText("CBR 600")).toBeInTheDocument();
  });

  it("renders the close button in the header", async () => {
    setupMocks();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /fechar comparação/i })).toBeInTheDocument();
  });
});

describe("ComparisonView — loading states (Requirement 3.3, 3.4)", () => {
  it("shows loading spinner for scores while evaluation is loading", () => {
    // Never resolves
    vi.mocked(tripsAPI.getTelemetry).mockReturnValue(new Promise(() => {}) as any);
    vi.mocked(tripsAPI.getEvaluation).mockReturnValue(new Promise(() => {}) as any);

    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByText(/a carregar scores/i)).toBeInTheDocument();
  });

  it("shows loading spinner for telemetry while telemetry is loading", () => {
    vi.mocked(tripsAPI.getTelemetry).mockReturnValue(new Promise(() => {}) as any);
    vi.mocked(tripsAPI.getEvaluation).mockReturnValue(new Promise(() => {}) as any);

    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByText(/a carregar telemetria/i)).toBeInTheDocument();
  });

  it("shows loading spinner for events while evaluation is loading", () => {
    vi.mocked(tripsAPI.getTelemetry).mockReturnValue(new Promise(() => {}) as any);
    vi.mocked(tripsAPI.getEvaluation).mockReturnValue(new Promise(() => {}) as any);

    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByText(/a carregar eventos/i)).toBeInTheDocument();
  });
});

describe("ComparisonView — error states (Requirement 3.3, 3.4)", () => {
  it("shows error message in scores section when evaluation fails", async () => {
    setupMocks("resolve", "reject");
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText(/erro ao carregar scores/i)).toBeInTheDocument();
    });
  });
});

describe("ComparisonView — close button behavior", () => {
  it("calls onClose when close button in header is clicked", async () => {
    setupMocks();
    const onClose = vi.fn();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={onClose} />
    );
    fireEvent.click(screen.getByRole("button", { name: /fechar comparação/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", async () => {
    setupMocks();
    const onClose = vi.fn();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose for other key presses", async () => {
    setupMocks();
    const onClose = vi.fn();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={onClose} />
    );
    fireEvent.keyDown(document, { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ComparisonView — null ML score (Requirement 5.4)", () => {
  it("shows N/D when mlScore is null", async () => {
    setupMocks("resolve", "resolve", undefined, makeEvaluationResponse({ mlScore: null }));
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    await waitFor(() => {
      const ndElements = screen.getAllByText("N/D");
      expect(ndElements.length).toBeGreaterThan(0);
    });
  });
});

describe("ComparisonView — zero events (Requirement 6.5)", () => {
  it("shows 'Sem eventos de risco' message when both trips have zero events", async () => {
    setupMocks(
      "resolve",
      "resolve",
      undefined,
      makeEvaluationResponse({
        severityCounts: { INFO: 0, WARNING: 0, CRITICAL: 0 },
        typeCounts: {},
      })
    );
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText(/sem eventos de risco em ambas as viagens/i)).toBeInTheDocument();
    });
  });
});

describe("ComparisonView — empty telemetry", () => {
  it("renders speed chart section even with empty telemetry", async () => {
    setupMocks("resolve", "resolve", makeTelemetryResponse(0));
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByTestId("overlay-speed-chart")).toBeInTheDocument();
    });
  });
});

describe("ComparisonView — data loaded successfully", () => {
  it("renders scores section with heuristic and ML labels after loading", async () => {
    setupMocks();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    await waitFor(() => {
      expect(screen.getByText("Heurístico")).toBeInTheDocument();
      expect(screen.getByText("Machine Learning")).toBeInTheDocument();
    });
  });

  it("renders trip stats section with metric labels", async () => {
    setupMocks();
    const trips = [makeTrip("trip-a"), makeTrip("trip-b", { id: "trip-b" })];
    render(
      <ComparisonView tripIds={["trip-a", "trip-b"]} trips={trips} onClose={vi.fn()} />
    );
    expect(screen.getByText("Distância")).toBeInTheDocument();
    expect(screen.getByText("Duração")).toBeInTheDocument();
    expect(screen.getByText("Vel. Média")).toBeInTheDocument();
    expect(screen.getByText("Vel. Máxima")).toBeInTheDocument();
  });
});
