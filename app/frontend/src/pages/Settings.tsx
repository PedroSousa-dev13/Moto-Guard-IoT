import { useEffect, useMemo, useState, ReactNode, FormEvent } from "react";
import Card from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { useI18n } from "../i18n";
import {
  applyTheme, defaultSettings, defaultThresholds, loadSettings, saveSettings,
  type AlertMinSeverity, type AppSettings, type Language, type MapStyle,
} from "../utils/settings";
import {
  Settings2, Bell, Sliders, Info, Sun, Moon, Globe, Gauge,
  Activity, Thermometer, Zap, Shield, Trash2, Check, RotateCcw,
  Monitor,
} from "lucide-react";

type Tab = "prefs" | "alerts" | "thresholds" | "about";

interface Msg { type: "success" | "error"; text: string }

export default function Settings() {
  const { user } = useAuth();
  const { t, setLanguage: setI18nLanguage } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>("prefs");
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

  function setThreshold<K extends keyof AppSettings["thresholds"]>(k: K, v: number) {
    setForm((p) => ({ ...p, thresholds: { ...p.thresholds, [k]: v } }));
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-text flex items-center gap-3 tracking-tight">
            <Settings2 className="text-accent" size={28} /> {t('settings.title')}
          </h1>
          <p className="text-muted text-sm font-medium">{t('settings.subtitle')}</p>
        </div>
        {isDirty && (
          <div className="flex items-center gap-3 animate-fade-in">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-muted hover:bg-white/5 transition-all" onClick={() => { setForm(loadSettings()); setMsg(null); }}>
              <RotateCcw size={14} /> {t('common.discard')}
            </button>
            <button className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-accent/20 transition-all active:scale-95" onClick={(e) => void handleSave(e)} disabled={isSaving}>
              <Check size={14} /> {isSaving ? t('settings.saving') : t('settings.saveChanges')}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-surface/40 backdrop-blur-md border border-white/10 rounded-2xl p-1 flex gap-1 mb-2">
        {TABS.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text hover:bg-white/5"}`}
            onClick={() => { setActiveTab(tab.id); setMsg(null); }}>
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

          <Card title={t('settings.appearance')} className="overflow-hidden">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue/10 flex items-center justify-center text-blue border border-blue/20">
                    <Sun size={18} />
                  </div>
                  <div className="flex flex-col">
                    <div className="font-black text-sm text-text">{t('settings.theme')}</div>
                    <div className="text-[0.7rem] text-muted font-bold uppercase tracking-tighter">{t('settings.themeLight')} / {t('settings.themeDark')} / Auto</div>
                  </div>
                </div>
                <div className="bg-black/20 border border-white/5 rounded-xl p-1 flex gap-1">
                  <button type="button"
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${form.theme === "light" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-text hover:bg-white/5"}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "light" }))}>
                    <Sun size={18} />
                  </button>
                  <button type="button"
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${form.theme === "dark" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-text hover:bg-white/5"}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "dark" }))}>
                    <Moon size={18} />
                  </button>
                  <button type="button"
                    className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${form.theme === "auto" ? "bg-accent text-white shadow-lg" : "text-muted hover:text-text hover:bg-white/5"}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "auto" }))}
                    title="Auto (18h-6h)">
                    <Monitor size={18} />
                  </button>
                </div>
              </div>
            </div>
          </Card>

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

          <div className="flex items-center justify-end gap-3 mt-4">
            <button type="button" className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-muted hover:bg-white/5 transition-all" onClick={() => { setForm(defaultSettings()); setMsg(null); }}>
              <RotateCcw size={16} /> {t('settings.resetDefault')}
            </button>
            <button type="submit" className="flex items-center gap-2 bg-accent text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" disabled={isSaving || !isDirty}>
              <Check size={18} /> {isSaving ? t('settings.saving') : t('common.save')}
            </button>
          </div>
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

          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-accent text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2" disabled={isSaving || !isDirty}>
              <Check size={18} /> {isSaving ? "A guardar..." : "Guardar Alterações"}
            </button>
          </div>
        </form>
      )}

      {/* ── Limiares ── */}
      {activeTab === "thresholds" && (
        <form onSubmit={(e) => void handleSave(e)} className="grid grid-cols-1 gap-6">
          <div className="bg-accent/10 border border-accent/20 rounded-2xl px-6 py-4 flex gap-4 items-center shadow-lg shadow-accent/5">
            <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent flex-shrink-0">
              <Shield size={20} />
            </div>
            <p className="text-sm font-bold text-text-2 m-0 leading-relaxed">
              Os limiares definem quando os alertas são gerados. <span className="text-yellow">Aviso = amarelo</span>, <span className="text-red">Crítico = vermelho</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                title: "Velocidade", icon: <Gauge size={18} />, unit: "km/h",
                fields: [
                  { id: "t-speed-warn", label: "Aviso", field: "maxSpeedKmhWarn" as const, min: 60, max: 200, step: 5 },
                  { id: "t-speed-crit", label: "Crítico", field: "maxSpeedKmhCrit" as const, min: 80, max: 300, step: 5 },
                ],
              },
              {
                title: "G-Force", icon: <Activity size={18} />, unit: "G",
                fields: [
                  { id: "t-gf-warn", label: "Aviso", field: "maxGForceWarn" as const, min: 0.1, max: 5, step: 0.05 },
                  { id: "t-gf-crit", label: "Crítico", field: "maxGForceCrit" as const, min: 0.1, max: 5, step: 0.05 },
                ],
              },
              {
                title: "Inclinação (Roll)", icon: <Sliders size={18} />, unit: "°",
                fields: [
                  { id: "t-roll-warn", label: "Aviso", field: "maxRollDegWarn" as const, min: 10, max: 90, step: 1 },
                  { id: "t-roll-crit", label: "Crítico", field: "maxRollDegCrit" as const, min: 10, max: 90, step: 1 },
                ],
              },
              {
                title: "Temperatura do Motor", icon: <Thermometer size={18} />, unit: "°C",
                fields: [
                  { id: "t-temp-warn", label: "Aviso", field: "maxEngineTempCWarn" as const, min: 60, max: 200, step: 5 },
                  { id: "t-temp-crit", label: "Crítico", field: "maxEngineTempCCrit" as const, min: 60, max: 200, step: 5 },
                ],
              },
            ].map(({ title, icon, unit, fields }) => (
              <Card key={title} title={title} className="overflow-hidden">
                <div className="flex flex-col gap-8">
                  {fields.map(({ id, label, field, min, max, step }) => (
                    <div key={field} className="flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <div className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest ${label === "Aviso" ? 'text-yellow' : 'text-red'}`}>
                          <div className={`w-2 h-2 rounded-full bg-current`} />
                          {label}
                        </div>
                        <div className="flex items-center gap-3">
                          <input id={id} className="bg-black/20 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-text font-black text-center focus:border-accent outline-none w-[70px]" type="number" min={min} max={max} step={step}
                            value={form.thresholds[field]}
                            onChange={(e) => setThreshold(field, Number(e.target.value))} />
                          <span className="text-[0.7rem] font-black text-muted uppercase">{unit}</span>
                        </div>
                      </div>
                      <input type="range" min={min} max={max} step={step}
                        value={form.thresholds[field]}
                        onChange={(e) => setThreshold(field, Number(e.target.value))}
                        className={`w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent ${label === "Aviso" ? 'accent-yellow' : 'accent-red'}`} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <button type="button" className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-muted hover:bg-white/5 transition-all"
              onClick={() => setForm((p) => ({ ...p, thresholds: defaultThresholds() }))}>
              <RotateCcw size={16} /> Repor padrão
            </button>
            <button type="submit" className="flex items-center gap-2 bg-accent text-white px-6 py-2.5 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed" disabled={isSaving || !isDirty}>
              <Check size={18} /> {isSaving ? "A guardar..." : "Guardar Alterações"}
            </button>
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
                    if (window.confirm("Apagar todos os dados locais? Esta ação é irreversível.")) {
                      localStorage.clear();
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
