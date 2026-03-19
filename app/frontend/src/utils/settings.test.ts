import { describe, it, expect, beforeEach } from "vitest";
import { loadSettings, saveSettings, defaultSettings, defaultThresholds } from "./settings";

beforeEach(() => {
  localStorage.clear();
});

describe("defaultSettings", () => {
  it("returns expected defaults", () => {
    const s = defaultSettings();
    expect(s.theme).toBe("light");
    expect(s.units).toBe("metric");
    expect(s.language).toBe("pt");
    expect(s.alerts.enabled).toBe(true);
    expect(s.alerts.minSeverity).toBe("INFO");
    expect(s.alerts.maxStored).toBe(500);
    expect(s.alerts.soundEnabled).toBe(false);
  });

  it("thresholds have sensible defaults", () => {
    const t = defaultThresholds();
    expect(t.maxSpeedKmhWarn).toBe(120);
    expect(t.maxSpeedKmhCrit).toBe(150);
    expect(t.maxRollDegWarn).toBe(40);
    expect(t.maxRollDegCrit).toBe(55);
  });
});

describe("loadSettings", () => {
  it("returns defaults when localStorage is empty", () => {
    const s = loadSettings();
    expect(s).toEqual(defaultSettings());
  });

  it("returns defaults when localStorage has invalid JSON", () => {
    localStorage.setItem("motoguard_settings", "not-json");
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it("loads saved theme correctly", () => {
    saveSettings({ ...defaultSettings(), theme: "dark" });
    expect(loadSettings().theme).toBe("dark");
  });

  it("falls back to light for unknown theme value", () => {
    localStorage.setItem("motoguard_settings", JSON.stringify({ theme: "purple" }));
    expect(loadSettings().theme).toBe("light");
  });

  it("loads saved units correctly", () => {
    saveSettings({ ...defaultSettings(), units: "imperial" });
    expect(loadSettings().units).toBe("imperial");
  });

  it("falls back to metric for unknown units value", () => {
    localStorage.setItem("motoguard_settings", JSON.stringify({ units: "furlongs" }));
    expect(loadSettings().units).toBe("metric");
  });

  it("loads valid language", () => {
    saveSettings({ ...defaultSettings(), language: "en" });
    expect(loadSettings().language).toBe("en");
  });

  it("falls back to pt for unknown language", () => {
    localStorage.setItem("motoguard_settings", JSON.stringify({ language: "fr" }));
    expect(loadSettings().language).toBe("pt");
  });

  it("loads alerts.enabled=false", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, enabled: false } });
    expect(loadSettings().alerts.enabled).toBe(false);
  });

  it("loads alerts.minSeverity=CRITICAL", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, minSeverity: "CRITICAL" } });
    expect(loadSettings().alerts.minSeverity).toBe("CRITICAL");
  });

  it("falls back to INFO for invalid minSeverity", () => {
    localStorage.setItem("motoguard_settings", JSON.stringify({ alerts: { minSeverity: "EXTREME" } }));
    expect(loadSettings().alerts.minSeverity).toBe("INFO");
  });

  it("clamps maxStored to default when out of range", () => {
    localStorage.setItem("motoguard_settings", JSON.stringify({ alerts: { maxStored: 5 } }));
    expect(loadSettings().alerts.maxStored).toBe(500);
  });

  it("accepts valid maxStored", () => {
    saveSettings({ ...defaultSettings(), alerts: { ...defaultSettings().alerts, maxStored: 100 } });
    expect(loadSettings().alerts.maxStored).toBe(100);
  });

  it("clamps threshold out of range to default", () => {
    localStorage.setItem("motoguard_settings", JSON.stringify({ thresholds: { maxSpeedKmhWarn: 5 } }));
    expect(loadSettings().thresholds.maxSpeedKmhWarn).toBe(120); // fallback
  });

  it("loads valid threshold", () => {
    saveSettings({ ...defaultSettings(), thresholds: { ...defaultThresholds(), maxSpeedKmhWarn: 100 } });
    expect(loadSettings().thresholds.maxSpeedKmhWarn).toBe(100);
  });
});

describe("saveSettings / loadSettings round-trip", () => {
  it("persists all fields correctly", () => {
    const custom = {
      ...defaultSettings(),
      theme: "dark" as const,
      units: "imperial" as const,
      language: "es" as const,
      alerts: {
        enabled: false,
        autoAckOnOpen: true,
        minSeverity: "WARNING" as const,
        maxStored: 200,
        soundEnabled: true,
      },
    };
    saveSettings(custom);
    const loaded = loadSettings();
    expect(loaded.theme).toBe("dark");
    expect(loaded.units).toBe("imperial");
    expect(loaded.language).toBe("es");
    expect(loaded.alerts.enabled).toBe(false);
    expect(loaded.alerts.autoAckOnOpen).toBe(true);
    expect(loaded.alerts.minSeverity).toBe("WARNING");
    expect(loaded.alerts.maxStored).toBe(200);
    expect(loaded.alerts.soundEnabled).toBe(true);
  });
});
