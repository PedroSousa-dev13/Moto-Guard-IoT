import { useEffect, useMemo, useState, ReactNode, FormEvent, useRef } from "react";
import Card from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";
import {
  applyTheme, defaultSettings, defaultThresholds, loadSettings, saveSettings,
  type AlertMinSeverity, type AppSettings, type Language, type MapStyle,
} from "../utils/settings";
import {
  Settings2, Bell, Sliders, Info, Globe, Gauge,
  Activity, Thermometer, Zap, Shield, Trash2, Check, RotateCcw,
} from "lucide-react";

type Tab = "prefs" | "alerts" | "thresholds" | "about";

interface Msg { type: "success" | "error"; text: string }

// Helper converters
const kmhToMph = (kmh: number) => Math.round(kmh * 0.621371);
const mphToKmh = (mph: number) => Math.round(mph / 0.621371);
const cToF = (c: number) => Math.round(c * 1.8 + 32);
const fToC = (f: number) => Math.round((f - 32) / 1.8);

interface ThresholdRegulatorProps {
  title: string;
  icon: ReactNode;
  category: "speed" | "gforce" | "roll" | "temp";
  unit: "metric" | "imperial";
  warnValue: number; // always stored in metric
  critValue: number; // always stored in metric
  onChange: (warn: number, crit: number) => void;
}

function ThresholdRegulator({
  title,
  icon,
  category,
  unit,
  warnValue,
  critValue,
  onChange,
}: ThresholdRegulatorProps) {
  const isImperial = unit === "imperial";
  const trackRef = useRef<HTMLDivElement>(null);

  // 1. Define bounds & steps depending on category and unit
  let trackMin = 0;
  let trackMax = 100;
  let step = 1;
  let unitLabel = "";

  // display values (converted if imperial)
  let displayWarn = warnValue;
  let displayCrit = critValue;

  if (category === "speed") {
    trackMin = isImperial ? 35 : 60;
    trackMax = isImperial ? 185 : 300;
    step = 5;
    unitLabel = isImperial ? "mph" : "km/h";
    displayWarn = isImperial ? kmhToMph(warnValue) : warnValue;
    displayCrit = isImperial ? kmhToMph(critValue) : critValue;
  } else if (category === "temp") {
    trackMin = isImperial ? 140 : 60;
    trackMax = isImperial ? 390 : 200;
    step = 5;
    unitLabel = isImperial ? "°F" : "°C";
    displayWarn = isImperial ? cToF(warnValue) : warnValue;
    displayCrit = isImperial ? cToF(critValue) : critValue;
  } else if (category === "gforce") {
    trackMin = 0.1;
    trackMax = 5.0;
    step = 0.05;
    unitLabel = "G";
  } else if (category === "roll") {
    trackMin = 10;
    trackMax = 90;
    step = 1;
    unitLabel = "°";
  }

  // 2. Keep local states for inputs so users can type freely
  const [inputWarn, setInputWarn] = useState(String(displayWarn));
  const [inputCrit, setInputCrit] = useState(String(displayCrit));

  // Sync inputs with display values when props change
  useEffect(() => {
    setInputWarn(String(displayWarn));
  }, [displayWarn]);

  useEffect(() => {
    setInputCrit(String(displayCrit));
  }, [displayCrit]);

  const updateValues = (newDisplayWarn: number, newDisplayCrit: number, lastModified: "warn" | "crit") => {
    let w = Math.max(trackMin, Math.min(trackMax, newDisplayWarn));
    let c = Math.max(trackMin, Math.min(trackMax, newDisplayCrit));

    // Round values to correct decimal places before comparing to avoid JS float precision bugs
    if (category === "gforce") {
      w = Math.round(w * 100) / 100;
      c = Math.round(c * 100) / 100;
    } else {
      w = Math.round(w);
      c = Math.round(c);
    }

    // Co-dependency constraints (strict unequal checks)
    if (lastModified === "warn" && w > c) {
      c = w;
    } else if (lastModified === "crit" && c < w) {
      w = c;
    }

    // Calculate final metric values without introducing round-trip drift to the unchanged field
    let metricWarn: number;
    let metricCrit: number;

    if (lastModified === "warn") {
      if (isImperial) {
        if (category === "speed") {
          metricWarn = mphToKmh(w);
        } else if (category === "temp") {
          metricWarn = fToC(w);
        } else {
          metricWarn = w;
        }
      } else {
        metricWarn = w;
      }

      // If Critical was pushed, match the metric value. Otherwise preserve the exact original value
      if (c === w) {
        metricCrit = metricWarn;
      } else {
        metricCrit = critValue;
      }
    } else {
      if (isImperial) {
        if (category === "speed") {
          metricCrit = mphToKmh(c);
        } else if (category === "temp") {
          metricCrit = fToC(c);
        } else {
          metricCrit = c;
        }
      } else {
        metricCrit = c;
      }

      // If Warning was pushed, match the metric value. Otherwise preserve the exact original value
      if (w === c) {
        metricWarn = metricCrit;
      } else {
        metricWarn = warnValue;
      }
    }

    onChange(metricWarn, metricCrit);
  };

  const handleInputChange = (val: string, type: "warn" | "crit") => {
    if (type === "warn") {
      setInputWarn(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        updateValues(parsed, displayCrit, "warn");
      }
    } else {
      setInputCrit(val);
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) {
        updateValues(displayWarn, parsed, "crit");
      }
    }
  };

  const handleInputBlur = (type: "warn" | "crit") => {
    const raw = type === "warn" ? parseFloat(inputWarn) : parseFloat(inputCrit);
    if (isNaN(raw)) {
      if (type === "warn") setInputWarn(String(displayWarn));
      else setInputCrit(String(displayCrit));
      return;
    }

    const clamped = Math.max(trackMin, Math.min(trackMax, raw));
    const stepped = Math.round(clamped / step) * step;

    if (type === "warn") {
      updateValues(stepped, displayCrit, "warn");
    } else {
      updateValues(displayWarn, stepped, "crit");
    }
  };

  const onDrag = (clientY: number, type: "warn" | "crit") => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const percentage = 1 - (y / rect.height);
    const clampedPercentage = Math.max(0, Math.min(1, percentage));
    const rawVal = trackMin + clampedPercentage * (trackMax - trackMin);
    const steppedVal = Math.round(rawVal / step) * step;

    if (type === "warn") {
      updateValues(steppedVal, displayCrit, "warn");
    } else {
      updateValues(displayWarn, steppedVal, "crit");
    }
  };

  const handleMouseDown = (e: React.MouseEvent, type: "warn" | "crit") => {
    e.preventDefault();
    const handleMove = (moveEvent: MouseEvent) => {
      onDrag(moveEvent.clientY, type);
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  const handleTouchStart = (e: React.TouchEvent, type: "warn" | "crit") => {
    const handleMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches[0]) {
        onDrag(moveEvent.touches[0].clientY, type);
      }
    };
    const handleUp = () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleUp);
  };

  // 3. Position percent (0-100) for handles placement
  const warnPercent = ((displayWarn - trackMin) / (trackMax - trackMin)) * 100;
  const critPercent = ((displayCrit - trackMin) / (trackMax - trackMin)) * 100;

  return (
    <Card className="flex flex-col items-center p-6 bg-surface/30 backdrop-blur-xl border border-white/5 rounded-3xl hover:border-accent/20 transition-all duration-300 shadow-2xl relative overflow-visible w-full min-h-[420px]">
      {/* Title & Icon Header */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-accent">{icon}</span>
        <span className="font-black text-xs text-text uppercase tracking-wider">{title}</span>
      </div>

      {/* Vertical Track Area */}
      <div className="relative h-[220px] w-full flex items-center justify-center my-4 select-none overflow-visible">
        {/* Central Ruler Line & Ticks */}
        <div ref={trackRef} className="relative h-full w-[40px] flex items-center justify-center">
          {/* 10 horizontal ticks perfectly distributed */}
          {Array.from({ length: 10 }).map((_, idx) => {
            const topPercent = (idx / 9) * 100;
            return (
              <div
                key={idx}
                className="absolute left-0 right-0 h-[1px] bg-white/10"
                style={{ top: `${topPercent}%` }}
              />
            );
          })}

          {/* Center Vertical Axis Line */}
          <div className="absolute top-0 bottom-0 w-[2px] bg-white/20" />
        </div>

        {/* Warning Droplet (Aviso) - Left side of the track, pointing right */}
        <div
          className="absolute cursor-ns-resize z-20 hover:z-30 active:z-30 flex items-center justify-end overflow-visible"
          style={{
            bottom: `${warnPercent}%`,
            right: "calc(50% + 2px)",
            transform: "translateY(50%)",
            width: "36px",
            height: "36px",
          }}
          onMouseDown={(e) => handleMouseDown(e, "warn")}
          onTouchStart={(e) => handleTouchStart(e, "warn")}
        >
          <div className="text-yellow hover:scale-110 active:scale-95 transition-all duration-150 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" transform="rotate(90 12 12)" />
            </svg>
          </div>
        </div>

        {/* Critical Droplet (Crítico) - Right side of the track, pointing left */}
        <div
          className="absolute cursor-ns-resize z-20 hover:z-30 active:z-30 flex items-center justify-start overflow-visible"
          style={{
            bottom: `${critPercent}%`,
            left: "calc(50% + 2px)",
            transform: "translateY(50%)",
            width: "36px",
            height: "36px",
          }}
          onMouseDown={(e) => handleMouseDown(e, "crit")}
          onTouchStart={(e) => handleTouchStart(e, "crit")}
        >
          <div className="text-red hover:scale-110 active:scale-95 transition-all duration-150 drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" transform="rotate(-90 12 12)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Input boxes under the track */}
      <div className="grid grid-cols-2 gap-4 w-full mt-6">
        {/* Left Column: Warning (Aviso) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.62rem] font-black text-yellow uppercase tracking-widest text-center">Aviso</span>
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputWarn}
              onChange={(e) => handleInputChange(e.target.value, "warn")}
              onBlur={() => handleInputBlur("warn")}
              className="w-full bg-black/30 border border-yellow/20 focus:border-yellow focus:ring-1 focus:ring-yellow/20 rounded-xl py-2 pl-3 pr-8 text-xs font-black text-center text-text outline-none transition-all"
            />
            <span className="absolute right-2.5 text-[0.6rem] font-black text-muted pointer-events-none uppercase">{unitLabel}</span>
          </div>
        </div>

        {/* Right Column: Critical (Crítico) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.62rem] font-black text-red uppercase tracking-widest text-center">Crítico</span>
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputCrit}
              onChange={(e) => handleInputChange(e.target.value, "crit")}
              onBlur={() => handleInputBlur("crit")}
              className="w-full bg-black/30 border border-red/20 focus:border-red focus:ring-1 focus:ring-red/20 rounded-xl py-2 pl-3 pr-8 text-xs font-black text-center text-text outline-none transition-all"
            />
            <span className="absolute right-2.5 text-[0.6rem] font-black text-muted pointer-events-none uppercase">{unitLabel}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { t, setLanguage: setI18nLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    try {
      const saved = sessionStorage.getItem("settings_active_tab");
      if (saved === "prefs" || saved === "alerts" || saved === "thresholds" || saved === "about") {
        return saved as Tab;
      }
    } catch {
      // ignore
    }
    return "prefs";
  });
  const [form, setForm] = useState<AppSettings>(() => loadSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: "prefs",      label: t('settings.preferences'), icon: <Settings2 size={15} /> },
    { id: "alerts",     label: t('settings.alerts'), icon: <Bell size={15} /> },
    { id: "thresholds", label: t('settings.thresholds'), icon: <Sliders size={15} /> },
    { id: "about",      label: t('settings.about'), icon: <Info size={15} /> },
  ];

  useEffect(() => { document.title = `${t('settings.title')} — MotoGuard`; }, [t]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(loadSettings()), [form]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setMsg(null);
    try {
      saveSettings(form);
      // Apply theme with night mode detection for Dashboard
      applyTheme(form.theme, true);
      setI18nLanguage(form.language);
      setMsg({ type: "success", text: t('settings.saveSuccess') });
    } catch {
      setMsg({ type: "error", text: t('settings.saveError') });
    } finally {
      setIsSaving(false);
    }
  }

  function setAlert<K extends keyof AppSettings["alerts"]>(k: K, v: AppSettings["alerts"][K]) {
    setForm((p) => ({ ...p, alerts: { ...p.alerts, [k]: v } }));
  }

  function handleRegulatorChange(
    warnKey: keyof AppSettings["thresholds"],
    critKey: keyof AppSettings["thresholds"],
    warnVal: number,
    critVal: number
  ) {
    setForm((p) => ({
      ...p,
      thresholds: {
        ...p.thresholds,
        [warnKey]: warnVal,
        [critKey]: critVal,
      },
    }));
  }

  function handleResetTab() {
    setMsg(null);
    const defaults = defaultSettings();
    if (activeTab === "prefs") {
      setForm((p) => ({
        ...p,
        theme: defaults.theme,
        units: defaults.units,
        language: defaults.language,
        mapStyle: defaults.mapStyle,
        mapAutopilot: defaults.mapAutopilot,
      }));
    } else if (activeTab === "alerts") {
      setForm((p) => ({
        ...p,
        alerts: defaults.alerts,
      }));
    } else if (activeTab === "thresholds") {
      setForm((p) => ({
        ...p,
        thresholds: defaults.thresholds,
      }));
    }
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-text flex items-center gap-4 tracking-tight">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <Settings2 size={24} />
            </div>
            {t('settings.title')}
          </h1>
          <p className="text-muted text-sm font-medium mt-1">{t('settings.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab !== "about" && (
            <button
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-muted hover:bg-white/5 hover:text-text transition-all"
              onClick={handleResetTab}
            >
              <RotateCcw size={14} /> {t('settings.resetDefault')}
            </button>
          )}
          {isDirty && (
            <>
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-muted hover:text-red hover:bg-red/5 transition-all"
                onClick={() => { setForm(loadSettings()); setMsg(null); }}
              >
                <Trash2 size={14} /> {t('common.discard')}
              </button>
              <button
                type="button"
                className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95"
                onClick={(e) => void handleSave(e)}
                disabled={isSaving}
              >
                <Check size={14} /> {isSaving ? t('settings.saving') : t('settings.saveChanges')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-surface/40 backdrop-blur-md border border-white/10 rounded-2xl p-1 flex gap-1 mb-2">
        {TABS.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text hover:bg-white/5"}`}
            onClick={() => {
              setActiveTab(tab.id);
              sessionStorage.setItem("settings_active_tab", tab.id);
              setMsg(null);
            }}>
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {msg && (
        <div role="status" aria-live="polite" className={`p-4 rounded-xl text-sm font-bold animate-fade-in border ${msg.type === "success" ? "bg-green/10 text-green border-green/20" : "bg-red/10 text-red border-red/20"}`}>
          {msg.text}
        </div>
      )}

      {/* ── Preferências ── */}
      {activeTab === "prefs" && (
        <form onSubmit={(e) => void handleSave(e)} className="grid grid-cols-1 gap-6">

          <Card title={t('settings.language')} className="overflow-hidden">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Globe size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">{t('settings.language')}</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">{t('settings.languageDesc')}</div>
                  </div>
                </div>
                <select className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-bold focus:border-accent outline-none appearance-none cursor-pointer min-w-[160px]"
                  value={form.language}
                  onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as Language }))}>
                  <option value="pt">🇵🇹 Português</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Gauge size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">{t('settings.units')}</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">{t('settings.unitsDesc')}</div>
                  </div>
                </div>
                <select className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-bold focus:border-accent outline-none appearance-none cursor-pointer min-w-[160px]"
                  value={form.units}
                  onChange={(e) => setForm((p) => ({ ...p, units: e.target.value as AppSettings["units"] }))}>
                  <option value="metric">{t('settings.unitsMetric')}</option>
                  <option value="imperial">{t('settings.unitsImperial')}</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title={t('map.title')} className="overflow-hidden">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Activity size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">{t('settings.mapStyle')}</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">{t('settings.mapStyleDesc')}</div>
                  </div>
                </div>
                <select className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-bold focus:border-accent outline-none appearance-none cursor-pointer min-w-[160px]"
                  value={form.mapStyle}
                  onChange={(e) => setForm((p) => ({ ...p, mapStyle: e.target.value as MapStyle }))}>
                  <option value="streets">{t('settings.mapStyleStreets')}</option>
                  <option value="satellite">{t('settings.mapStyleSatellite')}</option>
                </select>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Activity size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">{t('settings.mapAutopilot')}</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">{t('settings.mapAutopilotDesc')}</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer"
                    checked={form.mapAutopilot}
                    onChange={(e) => setForm((p) => ({ ...p, mapAutopilot: e.target.checked }))} />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent shadow-inner transition-colors"></div>
                </label>
              </div>
            </div>
          </Card>


        </form>
      )}

      {/* ── Alertas ── */}
      {activeTab === "alerts" && (
        <form onSubmit={(e) => void handleSave(e)} className="grid grid-cols-1 gap-6">
          <Card title="Notificações" className="overflow-hidden">
            <div className="flex flex-col gap-6">
              {[
                { icon: <Bell size={18} />, label: "Guardar alertas em histórico", desc: "Regista todos os alertas recebidos", field: "enabled" },
                { icon: <Bell size={18} />, label: "Som ao receber alerta", desc: "Reproduz um som quando chega um novo alerta", field: "soundEnabled" },
                { icon: <Check size={18} />, label: "Auto-reconhecer ao abrir", desc: "Marca o alerta como lido ao expandir", field: "autoAckOnOpen" }
              ].map((item, i) => (
                <div key={item.field}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex gap-4 items-center">
                      <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                        {item.icon}
                      </div>
                      <div className="flex flex-col">
                        <div className="font-black text-sm text-text">{item.label}</div>
                        <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">{item.desc}</div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer"
                        checked={form.alerts[item.field as keyof AppSettings["alerts"]] as boolean}
                        onChange={(e) => setAlert(item.field as any, e.target.checked)} />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent shadow-inner transition-colors"></div>
                    </label>
                  </div>
                  {i < 2 && <div className="h-px bg-white/5 mt-6" />}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Filtros & Limites" className="overflow-hidden">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Shield size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">Severidade mínima a registar</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">Alertas abaixo deste nível são ignorados</div>
                  </div>
                </div>
                <select className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-bold focus:border-accent outline-none appearance-none cursor-pointer min-w-[180px]"
                  value={form.alerts.minSeverity}
                  onChange={(e) => setAlert("minSeverity", e.target.value as AlertMinSeverity)}>
                  <option value="INFO">INFO — todos</option>
                  <option value="WARNING">WARNING e acima</option>
                  <option value="CRITICAL">Apenas CRITICAL</option>
                </select>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Activity size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">Máx. alertas em histórico</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">Alertas mais antigos são removidos automaticamente</div>
                  </div>
                </div>
                <input className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-text font-black text-center focus:border-accent outline-none w-[100px]" type="number"
                  min={10} max={2000} step={10} value={form.alerts.maxStored}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 10 && v <= 2000) setAlert("maxStored", v);
                  }} />
              </div>
            </div>
          </Card>


        </form>
      )}

      {/* ── Limiares ── */}
      {activeTab === "thresholds" && (
        <form onSubmit={(e) => void handleSave(e)} className="grid grid-cols-1 gap-8">
          <div className="bg-accent/10 border border-accent/20 rounded-2xl px-6 py-4 flex gap-4 items-center shadow-lg shadow-accent/5">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
              <Shield size={20} />
            </div>
            <p className="text-sm font-bold text-text-2 m-0 leading-relaxed">
              Os limiares definem quando os alertas são gerados no sistema. Arraste as gotas ou edite os valores numéricos em baixo. <span className="text-yellow">Aviso = gota esquerda</span>, <span className="text-red">Crítico = gota direita</span>.
            </p>
          </div>

          {/* 4 Vertical Regulator Sliders in a responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <ThresholdRegulator
              title="Velocidade"
              icon={<Gauge size={18} />}
              category="speed"
              unit={form.units}
              warnValue={form.thresholds.maxSpeedKmhWarn}
              critValue={form.thresholds.maxSpeedKmhCrit}
              onChange={(w, c) => handleRegulatorChange("maxSpeedKmhWarn", "maxSpeedKmhCrit", w, c)}
            />

            <ThresholdRegulator
              title="Força G"
              icon={<Activity size={18} />}
              category="gforce"
              unit={form.units}
              warnValue={form.thresholds.maxGForceWarn}
              critValue={form.thresholds.maxGForceCrit}
              onChange={(w, c) => handleRegulatorChange("maxGForceWarn", "maxGForceCrit", w, c)}
            />

            <ThresholdRegulator
              title="Inclinação (Roll)"
              icon={<Sliders size={18} />}
              category="roll"
              unit={form.units}
              warnValue={form.thresholds.maxRollDegWarn}
              critValue={form.thresholds.maxRollDegCrit}
              onChange={(w, c) => handleRegulatorChange("maxRollDegWarn", "maxRollDegCrit", w, c)}
            />

            <ThresholdRegulator
              title="Temp. Motor"
              icon={<Thermometer size={18} />}
              category="temp"
              unit={form.units}
              warnValue={form.thresholds.maxEngineTempCWarn}
              critValue={form.thresholds.maxEngineTempCCrit}
              onChange={(w, c) => handleRegulatorChange("maxEngineTempCWarn", "maxEngineTempCCrit", w, c)}
            />
          </div>


        </form>
      )}

      {/* ── Sobre ── */}
      {activeTab === "about" && (
        <div className="grid grid-cols-1 gap-6">
          <Card title="MotoGuard IoT" className="overflow-hidden">
            <div className="flex flex-col gap-4">
              {[
                { label: "Aplicação", val: "MotoGuard IoT" },
                { label: "Versão", val: "1.0.0" },
                { label: "Ambiente", val: import.meta.env.MODE ?? "production" },
                { label: "API Base", val: "/api" },
                { label: "Utilizador", val: user?.email ?? "—" },
                { label: "Conta criada", val: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-PT") : "—" },
              ].map(({ label, val }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-muted font-bold">{label}</span>
                  <span className="text-sm text-text font-black">{val}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Tecnologias" className="overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: "React 18", desc: "Interface de utilizador" },
                { name: "TypeScript", desc: "Tipagem estática" },
                { name: "Socket.IO", desc: "Telemetria em tempo real" },
                { name: "Leaflet", desc: "Mapas interativos" },
                { name: "Three.js", desc: "Modelo 3D da mota" },
                { name: "InfluxDB", desc: "Séries temporais" },
                { name: "PostgreSQL", desc: "Base de dados relacional" },
                { name: "MQTT", desc: "Protocolo IoT" },
              ].map(({ name, desc }) => (
                <div key={name} className="flex flex-col gap-1 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-accent/30 transition-all group">
                  <div className="font-black text-sm text-text group-hover:text-accent transition-colors">{name}</div>
                  <div className="text-[0.7rem] text-muted font-medium leading-tight">{desc}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Privacidade & Dados" className="overflow-hidden">
            <div className="flex flex-col gap-6">
              <p className="text-sm text-text-2 leading-relaxed font-medium m-0">
                As preferências e alertas são guardados localmente no teu browser via <code className="bg-white/5 px-1.5 py-0.5 rounded text-accent">localStorage</code>.
                Nenhum dado é partilhado com terceiros. Os dados de telemetria são processados localmente no servidor.
              </p>
              <div className="flex items-center justify-between gap-6 p-5 rounded-2xl bg-red/5 border border-red/10">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-red/10 flex items-center justify-center text-red border border-red/20 shadow-inner">
                    <Trash2 size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-red">Limpar dados locais</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">Remove preferências, alertas e sessão guardada</div>
                  </div>
                </div>
                <button className="flex items-center gap-2 bg-red/20 text-red px-5 py-2.5 rounded-xl font-bold hover:bg-red/30 transition-all active:scale-95 text-sm"
                  onClick={() => {
                    if (window.confirm("Apagar dados da aplicação? As preferências serão perdidas.")) {
                      const appKeys = [
                        "motoguard_settings", "motoguard_alerts",
                        "rememberMe", "user", "session_user",
                      ];
                      appKeys.forEach((k) => {
                        try { localStorage.removeItem(k); } catch { /* ignore */ }
                      });
                      window.location.reload();
                    }
                  }}>
                  <Trash2 size={16} /> Limpar
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
