import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadAlerts, saveAlerts, pushAlert } from "./alerts";
import type { AlertItem } from "./alerts";
import { saveSettings, defaultSettings } from "./settings";

function makeAlert(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    id: "a1",
    title: "Test Alert",
    message: "Something happened",
    severity: "INFO",
    status: "unread",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  // Ensure alerts are enabled by default
  saveSettings(defaultSettings());
});

// ─── loadAlerts ───────────────────────────────────────────────────────────────

describe("loadAlerts", () => {
  it("returns empty array when nothing stored", () => {
    expect(loadAlerts()).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    localStorage.setItem("motoguard_alerts", "bad-json");
    expect(loadAlerts()).toEqual([]);
  });

  it("returns empty array when stored value is not an array", () => {
    localStorage.setItem("motoguard_alerts", JSON.stringify({ id: "x" }));
    expect(loadAlerts()).toEqual([]);
  });

  it("returns stored alerts", () => {
    const alerts = [makeAlert({ id: "1" }), makeAlert({ id: "2" })];
    saveAlerts(alerts);
    expect(loadAlerts()).toHaveLength(2);
  });
});

// ─── saveAlerts ───────────────────────────────────────────────────────────────

describe("saveAlerts", () => {
  it("persists alerts to localStorage", () => {
    const alerts = [makeAlert({ id: "x" })];
    saveAlerts(alerts);
    expect(loadAlerts()[0].id).toBe("x");
  });

  it("dispatches motoguard:alerts event", () => {
    const handler = vi.fn();
    window.addEventListener("motoguard:alerts", handler);
    saveAlerts([]);
    expect(handler).toHaveBeenCalled();
    window.removeEventListener("motoguard:alerts", handler);
  });
});

// ─── pushAlert ────────────────────────────────────────────────────────────────

describe("pushAlert", () => {
  it("adds alert to the list", () => {
    pushAlert(makeAlert({ id: "new" }));
    expect(loadAlerts()).toHaveLength(1);
    expect(loadAlerts()[0].id).toBe("new");
  });

  it("prepends new alert (most recent first)", () => {
    pushAlert(makeAlert({ id: "first" }));
    pushAlert(makeAlert({ id: "second" }));
    expect(loadAlerts()[0].id).toBe("second");
  });

  it("does not add duplicate alert (same id)", () => {
    pushAlert(makeAlert({ id: "dup" }));
    pushAlert(makeAlert({ id: "dup" }));
    expect(loadAlerts()).toHaveLength(1);
  });

  it("does not add alert when alerts.enabled=false", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, enabled: false } });
    pushAlert(makeAlert({ id: "blocked" }));
    expect(loadAlerts()).toHaveLength(0);
  });

  it("respects minSeverity=WARNING — blocks INFO", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, minSeverity: "WARNING" } });
    pushAlert(makeAlert({ id: "info", severity: "INFO" }));
    expect(loadAlerts()).toHaveLength(0);
  });

  it("respects minSeverity=WARNING — allows WARNING", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, minSeverity: "WARNING" } });
    pushAlert(makeAlert({ id: "warn", severity: "WARNING" }));
    expect(loadAlerts()).toHaveLength(1);
  });

  it("respects minSeverity=WARNING — allows CRITICAL", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, minSeverity: "WARNING" } });
    pushAlert(makeAlert({ id: "crit", severity: "CRITICAL" }));
    expect(loadAlerts()).toHaveLength(1);
  });

  it("respects minSeverity=CRITICAL — blocks WARNING", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, minSeverity: "CRITICAL" } });
    pushAlert(makeAlert({ id: "warn", severity: "WARNING" }));
    expect(loadAlerts()).toHaveLength(0);
  });

  it("respects maxStored limit", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, maxStored: 10 } });
    for (let i = 0; i < 13; i++) {
      pushAlert(makeAlert({ id: `a${i}` }));
    }
    expect(loadAlerts()).toHaveLength(10);
  });

  it("keeps newest alerts when maxStored is exceeded", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, maxStored: 10 } });
    for (let i = 0; i < 12; i++) {
      pushAlert(makeAlert({ id: `item-${i}` }));
    }
    const stored = loadAlerts();
    expect(stored).toHaveLength(10);
    // Most recent should be first
    expect(stored[0].id).toBe("item-11");
    expect(stored[9].id).toBe("item-2");
  });
});
