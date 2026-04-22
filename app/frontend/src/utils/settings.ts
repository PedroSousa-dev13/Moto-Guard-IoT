export type Theme = "light" | "dark" | "auto";
export type Units = "metric" | "imperial";
export type Language = "pt" | "en" | "es";
export type AlertMinSeverity = "INFO" | "WARNING" | "CRITICAL";
export type MapStyle = "streets" | "satellite";

export interface Thresholds {
  maxSpeedKmhWarn: number;
  maxSpeedKmhCrit: number;
  maxGForceWarn: number;
  maxGForceCrit: number;
  maxRollDegWarn: number;
  maxRollDegCrit: number;
  maxEngineTempCWarn: number;
  maxEngineTempCCrit: number;
}

export interface AppSettings {
  theme: Theme;
  units: Units;
  language: Language;
  mapStyle: MapStyle;
  mapAutopilot: boolean;
  alerts: {
    enabled: boolean;
    autoAckOnOpen: boolean;
    minSeverity: AlertMinSeverity;
    maxStored: number;
    soundEnabled: boolean;
  };
  thresholds: Thresholds;
}

const KEY = "motoguard_settings";

export function defaultThresholds(): Thresholds {
  return {
    maxSpeedKmhWarn: 120,
    maxSpeedKmhCrit: 150,
    maxGForceWarn: 0.6,
    maxGForceCrit: 0.8,
    maxRollDegWarn: 40,
    maxRollDegCrit: 55,
    maxEngineTempCWarn: 110,
    maxEngineTempCCrit: 130,
  };
}

export function defaultSettings(): AppSettings {
  return {
    theme: "dark",
    units: "metric",
    language: "pt",
    mapStyle: "streets",
    mapAutopilot: false,
    alerts: {
      enabled: true,
      autoAckOnOpen: false,
      minSeverity: "INFO",
      maxStored: 500,
      soundEnabled: false,
    },
    thresholds: defaultThresholds(),
  };
}

function safeNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const base = defaultSettings();
    const dt = base.thresholds;
    const pt = (parsed.thresholds ?? {}) as Partial<Thresholds>;
    const maxStored = Number(parsed.alerts?.maxStored);
    return {
      theme: (["light", "dark", "auto"] as Theme[]).includes(parsed.theme as Theme)
        ? (parsed.theme as Theme)
        : base.theme,
      units: parsed.units === "imperial" ? "imperial" : "metric",
      language: (["pt", "en", "es"] as Language[]).includes(parsed.language as Language)
        ? (parsed.language as Language)
        : base.language,
      mapStyle: (["streets", "satellite"] as MapStyle[]).includes(parsed.mapStyle as MapStyle)
        ? (parsed.mapStyle as MapStyle)
        : base.mapStyle,
      mapAutopilot: typeof parsed.mapAutopilot === "boolean" ? parsed.mapAutopilot : base.mapAutopilot,
      alerts: {
        enabled: typeof parsed.alerts?.enabled === "boolean" ? parsed.alerts.enabled : base.alerts.enabled,
        autoAckOnOpen: typeof parsed.alerts?.autoAckOnOpen === "boolean" ? parsed.alerts.autoAckOnOpen : base.alerts.autoAckOnOpen,
        minSeverity: (["INFO", "WARNING", "CRITICAL"] as AlertMinSeverity[]).includes(parsed.alerts?.minSeverity as AlertMinSeverity)
          ? (parsed.alerts!.minSeverity as AlertMinSeverity)
          : base.alerts.minSeverity,
        maxStored: Number.isFinite(maxStored) && maxStored >= 10 && maxStored <= 2000 ? maxStored : base.alerts.maxStored,
        soundEnabled: typeof parsed.alerts?.soundEnabled === "boolean" ? parsed.alerts.soundEnabled : base.alerts.soundEnabled,
      },
      thresholds: {
        maxSpeedKmhWarn: safeNum(pt.maxSpeedKmhWarn, 60, 200, dt.maxSpeedKmhWarn),
        maxSpeedKmhCrit: safeNum(pt.maxSpeedKmhCrit, 80, 300, dt.maxSpeedKmhCrit),
        maxGForceWarn: safeNum(pt.maxGForceWarn, 0.1, 5, dt.maxGForceWarn),
        maxGForceCrit: safeNum(pt.maxGForceCrit, 0.1, 5, dt.maxGForceCrit),
        maxRollDegWarn: safeNum(pt.maxRollDegWarn, 10, 90, dt.maxRollDegWarn),
        maxRollDegCrit: safeNum(pt.maxRollDegCrit, 10, 90, dt.maxRollDegCrit),
        maxEngineTempCWarn: safeNum(pt.maxEngineTempCWarn, 60, 200, dt.maxEngineTempCWarn),
        maxEngineTempCCrit: safeNum(pt.maxEngineTempCCrit, 60, 200, dt.maxEngineTempCCrit),
      },
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
  applyTheme(s.theme);
}

/**
 * Check if current time is considered "night" (18:00 - 06:00)
 * This is used for automatic night mode in the Dashboard
 */
export function isNightTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

/**
 * Get the effective theme based on current settings.
 * If theme is "auto", returns "dark" during night time (18:00-06:00), "light" otherwise.
 */
export function getEffectiveTheme(theme: Theme): "light" | "dark" {
  if (theme === "auto") {
    return isNightTime() ? "dark" : "light";
  }
  return theme;
}

/**
 * Apply theme to the document.
 * For Dashboard, this also adds a data attribute for night mode specific styles.
 */
export function applyTheme(theme: Theme, applyNightMode: boolean = false) {
  const effectiveTheme = getEffectiveTheme(theme);
  document.documentElement.dataset.theme = effectiveTheme;

  // For Dashboard night mode auto-detection
  if (applyNightMode && theme === "auto") {
    const isNight = isNightTime();
    document.documentElement.dataset.nightMode = isNight ? "on" : "off";
  } else {
    delete document.documentElement.dataset.nightMode;
  }
}

/**
 * Get night mode phase for more granular styling
 * - "evening": 18:00 - 21:00 (transition period)
 * - "night": 21:00 - 05:00 (full night)
 * - "early": 05:00 - 06:00 (transition period)
 * - "day": 06:00 - 18:00 (day time)
 */
export function getNightModePhase(): "evening" | "night" | "early" | "day" {
  const hour = new Date().getHours();
  if (hour >= 18 && hour < 21) return "evening";
  if (hour >= 21 || hour < 5) return "night";
  if (hour >= 5 && hour < 6) return "early";
  return "day";
}
