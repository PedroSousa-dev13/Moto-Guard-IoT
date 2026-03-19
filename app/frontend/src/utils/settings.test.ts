import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme, defaultSettings, loadSettings, saveSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (document.documentElement as any).dataset.theme;
  });

  it("returns defaults when empty", () => {
    expect(loadSettings()).toEqual(defaultSettings());
  });

  it("persists and reloads", () => {
    const s = defaultSettings();
    s.theme = "dark";
    s.units = "imperial";
    s.alerts.enabled = false;
    saveSettings(s);
    expect(loadSettings()).toEqual(s);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("applies theme without saving", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});

