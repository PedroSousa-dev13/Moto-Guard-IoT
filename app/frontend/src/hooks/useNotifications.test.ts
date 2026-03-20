// =============================================================================
// Testes: useNotifications hook
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { saveAlerts, loadAlerts, type AlertItem } from "../utils/alerts";
import { saveSettings, defaultSettings } from "../utils/settings";

// ── Mock socket.io-client ─────────────────────────────────────────────────────

type SocketHandler = (...args: any[]) => void;

const mockSocketHandlers: Record<string, SocketHandler[]> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: SocketHandler) => {
    if (!mockSocketHandlers[event]) mockSocketHandlers[event] = [];
    mockSocketHandlers[event].push(handler);
  }),
  off: vi.fn((event: string, handler: SocketHandler) => {
    if (mockSocketHandlers[event]) {
      mockSocketHandlers[event] = mockSocketHandlers[event].filter((h) => h !== handler);
    }
  }),
  connected: true,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

function emitSocket(event: string, data: unknown) {
  (mockSocketHandlers[event] ?? []).forEach((h) => h(data));
}

// ── Import after mock ─────────────────────────────────────────────────────────

import { useNotifications } from "./useNotifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAlertEvent(overrides: Partial<{
  status: string; severity: string; message: string;
  deviceId: string; motoModel: string; timestamp: string; tripId: string;
}> = {}) {
  return {
    status: "HARD_BRAKING",
    severity: "WARNING",
    message: "Travagem brusca",
    deviceId: "MOTOGUARD-SIM-01",
    motoModel: "Naked",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  saveSettings(defaultSettings());
  // Reset handlers
  Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── unreadCount ──────────────────────────────────────────────────────────────

describe("useNotifications — unreadCount", () => {
  it("starts at 0 when no alerts stored", () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(0);
  });

  it("reflects existing unread alerts on mount", () => {
    const alerts: AlertItem[] = [
      { id: "a1", title: "T", message: "M", severity: "INFO", status: "unread", timestamp: new Date().toISOString() },
      { id: "a2", title: "T", message: "M", severity: "INFO", status: "ack", timestamp: new Date().toISOString() },
    ];
    saveAlerts(alerts);
    const { result } = renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(1);
  });

  it("increments unreadCount when alert event arrives", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent());
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("increments for each unique alert", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ status: "HARD_BRAKING", timestamp: "2026-01-01T10:00:00Z" }));
      emitSocket("alert", makeAlertEvent({ status: "OVERHEAT", timestamp: "2026-01-01T10:01:00Z" }));
    });
    expect(result.current.unreadCount).toBe(2);
  });

  it("does not increment for duplicate alert id", () => {
    const { result } = renderHook(() => useNotifications());
    const ev = makeAlertEvent({ timestamp: "2026-01-01T10:00:00Z" });
    act(() => {
      emitSocket("alert", ev);
      emitSocket("alert", ev); // same id
    });
    expect(result.current.unreadCount).toBe(1);
  });

  it("updates unreadCount when motoguard:alerts event fires", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      const alerts: AlertItem[] = [
        { id: "x1", title: "T", message: "M", severity: "WARNING", status: "unread", timestamp: new Date().toISOString() },
        { id: "x2", title: "T", message: "M", severity: "WARNING", status: "unread", timestamp: new Date().toISOString() },
      ];
      saveAlerts(alerts); // triggers motoguard:alerts event
    });
    expect(result.current.unreadCount).toBe(2);
  });
});

// ─── markAllRead ──────────────────────────────────────────────────────────────

describe("useNotifications — markAllRead", () => {
  it("sets all alerts to ack and resets unreadCount to 0", () => {
    const alerts: AlertItem[] = [
      { id: "a1", title: "T", message: "M", severity: "CRITICAL", status: "unread", timestamp: new Date().toISOString() },
      { id: "a2", title: "T", message: "M", severity: "WARNING", status: "unread", timestamp: new Date().toISOString() },
    ];
    saveAlerts(alerts);
    const { result } = renderHook(() => useNotifications());
    expect(result.current.unreadCount).toBe(2);

    act(() => result.current.markAllRead());

    expect(result.current.unreadCount).toBe(0);
    expect(loadAlerts().every((a) => a.status === "ack")).toBe(true);
  });

  it("is idempotent when no unread alerts", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => result.current.markAllRead());
    expect(result.current.unreadCount).toBe(0);
  });
});

// ─── markRead ─────────────────────────────────────────────────────────────────

describe("useNotifications — markRead", () => {
  it("marks a single alert as ack", () => {
    const alerts: AlertItem[] = [
      { id: "a1", title: "T", message: "M", severity: "CRITICAL", status: "unread", timestamp: new Date().toISOString() },
      { id: "a2", title: "T", message: "M", severity: "WARNING", status: "unread", timestamp: new Date().toISOString() },
    ];
    saveAlerts(alerts);
    const { result } = renderHook(() => useNotifications());

    act(() => result.current.markRead("a1"));

    expect(result.current.unreadCount).toBe(1);
    const stored = loadAlerts();
    expect(stored.find((a) => a.id === "a1")?.status).toBe("ack");
    expect(stored.find((a) => a.id === "a2")?.status).toBe("unread");
  });

  it("does nothing for unknown id", () => {
    const alerts: AlertItem[] = [
      { id: "a1", title: "T", message: "M", severity: "INFO", status: "unread", timestamp: new Date().toISOString() },
    ];
    saveAlerts(alerts);
    const { result } = renderHook(() => useNotifications());

    act(() => result.current.markRead("does-not-exist"));

    expect(result.current.unreadCount).toBe(1);
  });
});

// ─── toast ────────────────────────────────────────────────────────────────────

describe("useNotifications — toast", () => {
  it("toast is null initially", () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.toast).toBeNull();
  });

  it("shows toast for WARNING alert", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "WARNING", status: "OVERHEAT" }));
    });
    expect(result.current.toast).not.toBeNull();
    expect(result.current.toast?.severity).toBe("WARNING");
  });

  it("shows toast for CRITICAL alert", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "CRITICAL", status: "CRASH_DETECTED" }));
    });
    expect(result.current.toast?.severity).toBe("CRITICAL");
  });

  it("does NOT show toast for INFO alert", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "INFO", status: "HARD_BRAKING" }));
    });
    expect(result.current.toast).toBeNull();
  });

  it("toast includes tripId when present", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "CRITICAL", tripId: "trip-123" }));
    });
    expect(result.current.toast?.tripId).toBe("trip-123");
  });

  it("dismissToast clears the toast", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "CRITICAL" }));
    });
    expect(result.current.toast).not.toBeNull();

    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });

  it("toast title is formatted from status (underscores → spaces)", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "CRITICAL", status: "CRASH_DETECTED" }));
    });
    expect(result.current.toast?.title).toBe("CRASH DETECTED");
  });

  it("toast auto-dismisses after timeout (fake timers)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({ severity: "WARNING" }));
    });
    expect(result.current.toast).not.toBeNull();

    act(() => vi.advanceTimersByTime(7000));
    expect(result.current.toast).toBeNull();
  });
});

// ─── trip_started / trip_ended ────────────────────────────────────────────────

describe("useNotifications — trip events", () => {
  it("adds INFO alert when trip_started fires", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("trip_started", {
        deviceId: "MOTOGUARD-SIM-01",
        motoModel: "Naked",
        timestamp: new Date().toISOString(),
        tripId: "t1",
      });
    });
    const alerts = loadAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe("Viagem iniciada");
    expect(alerts[0].severity).toBe("INFO");
    expect(alerts[0].tripId).toBe("t1");
  });

  it("adds INFO alert when trip_ended fires", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("trip_ended", {
        deviceId: "MOTOGUARD-SIM-01",
        motoModel: "Naked",
        timestamp: new Date().toISOString(),
        tripId: "t2",
        distanceKm: 12.5,
      });
    });
    const alerts = loadAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toBe("Viagem terminada");
    expect(alerts[0].message).toContain("12.5 km");
  });

  it("does not add trip events when alerts.enabled=false", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, enabled: false } });
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("trip_started", {
        deviceId: "SIM-01", motoModel: "Naked",
        timestamp: new Date().toISOString(), tripId: "t1",
      });
    });
    expect(loadAlerts()).toHaveLength(0);
  });
});

// ─── severity inference from status ──────────────────────────────────────────

describe("useNotifications — severity inference", () => {
  it("infers CRITICAL from CRASH status when no severity field", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", { status: "CRASH_DETECTED", deviceId: "SIM", motoModel: "Naked", timestamp: new Date().toISOString() });
    });
    const alerts = loadAlerts();
    expect(alerts[0].severity).toBe("CRITICAL");
  });

  it("infers WARNING from OVER status when no severity field", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", { status: "OVERHEAT", deviceId: "SIM", motoModel: "Naked", timestamp: new Date().toISOString() });
    });
    const alerts = loadAlerts();
    expect(alerts[0].severity).toBe("WARNING");
  });

  it("infers INFO for unknown status", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", { status: "HARD_BRAKING", deviceId: "SIM", motoModel: "Naked", timestamp: new Date().toISOString() });
    });
    const alerts = loadAlerts();
    expect(alerts[0].severity).toBe("INFO");
  });

  it("uses explicit severity field when provided", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", { status: "HARD_BRAKING", severity: "CRITICAL", deviceId: "SIM", motoModel: "Naked", timestamp: new Date().toISOString() });
    });
    const alerts = loadAlerts();
    expect(alerts[0].severity).toBe("CRITICAL");
  });
});

// ─── alertas preditivos (4.5) ─────────────────────────────────────────────────

describe("useNotifications — alertas preditivos", () => {
  it("marca meta.predictive=true para mensagem com 'Tendência'", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "INFO",
        status: "OVERHEAT",
        message: "Tendência de temperatura: possível limiar em ~5 min",
      }));
    });
    const alerts = loadAlerts();
    expect((alerts[0].meta as any)?.predictive).toBe(true);
  });

  it("marca meta.predictive=true para mensagem com 'possível'", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "INFO",
        status: "TIRE_PRESSURE_LOW",
        message: "Tendência de pressão: possível perda lenta",
      }));
    });
    const alerts = loadAlerts();
    expect((alerts[0].meta as any)?.predictive).toBe(true);
  });

  it("marca meta.predictive=false para alerta reativo normal", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "WARNING",
        status: "OVERHEAT",
        message: "Sobreaquecimento persistente (115.0°C)",
      }));
    });
    const alerts = loadAlerts();
    expect((alerts[0].meta as any)?.predictive).toBe(false);
  });

  it("toast preditivo tem flag predictive=true", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "WARNING",
        status: "OVERHEAT",
        message: "Tendência de temperatura: possível limiar em ~3 min",
      }));
    });
    expect(result.current.toast?.predictive).toBe(true);
  });

  it("toast reativo tem flag predictive=false ou undefined", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "CRITICAL",
        status: "CRASH_DETECTED",
        message: "Queda detetada",
      }));
    });
    expect(result.current.toast?.predictive).toBeFalsy();
  });

  it("toast preditivo tem título com prefixo 📈", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "WARNING",
        status: "LOW_VOLTAGE",
        message: "Tendência de voltagem: possível limiar em ~10 min",
      }));
    });
    expect(result.current.toast?.title).toContain("📈");
  });

  it("toast reativo NÃO tem prefixo 📈 no título", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "CRITICAL",
        status: "CRASH_DETECTED",
        message: "Queda detetada",
      }));
    });
    expect(result.current.toast?.title).not.toContain("📈");
  });

  it("alerta preditivo de voltagem é detetado corretamente", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "INFO",
        status: "LOW_VOLTAGE",
        message: "Tendência de voltagem: possível limiar em ~8 min",
      }));
    });
    const alerts = loadAlerts();
    expect((alerts[0].meta as any)?.predictive).toBe(true);
  });

  it("alerta preditivo de pneu é detetado corretamente", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "INFO",
        status: "TIRE_PRESSURE_LOW",
        message: "Tendência de pressão: possível perda lenta",
      }));
    });
    const alerts = loadAlerts();
    expect((alerts[0].meta as any)?.predictive).toBe(true);
  });

  it("alerta sem message não é marcado como preditivo", () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      emitSocket("alert", makeAlertEvent({
        severity: "WARNING",
        status: "OVERHEAT",
        // sem message — usa fallback
      }));
    });
    const alerts = loadAlerts();
    expect((alerts[0].meta as any)?.predictive).toBe(false);
  });
});
