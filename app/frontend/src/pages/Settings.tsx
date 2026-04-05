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
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title"><Settings2 className="title-icon" size={24} />{t('settings.title')}</div>
          <div className="page-subtitle">{t('settings.subtitle')}</div>
        </div>
        {isDirty && (
          <div className="page-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => { setForm(loadSettings()); setMsg(null); }}>
              <RotateCcw size={14} /> {t('common.discard')}
            </button>
            <button className="btn btn-primary btn-sm" onClick={(e) => void handleSave(e)} disabled={isSaving}>
              <Check size={14} /> {isSaving ? t('settings.saving') : t('settings.saveChanges')}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="settings-tabs" role="tablist">
        {TABS.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
            className={`settings-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => { setActiveTab(tab.id); setMsg(null); }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {msg && (
        <div role="status" aria-live="polite" className={`alert ${msg.type === "success" ? "alert-success" : "alert-danger"}`}>
          {msg.text}
        </div>
      )}

      {/* ── Preferências ── */}
      {activeTab === "prefs" && (
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 16 }}>

          <Card title={t('settings.appearance')}>
            <div className="settings-option-group">
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Sun size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">{t('settings.theme')}</div>
                    <div className="settings-option-desc">{t('settings.themeLight')} / {t('settings.themeDark')} / Auto (18h-6h)</div>
                  </div>
                </div>
                <div className="theme-toggle-group">
                  <button type="button"
                    className={`theme-btn ${form.theme === "light" ? "active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "light" }))}>
                    <Sun size={14} /> {t('settings.themeLight')}
                  </button>
                  <button type="button"
                    className={`theme-btn ${form.theme === "dark" ? "active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "dark" }))}>
                    <Moon size={14} /> {t('settings.themeDark')}
                  </button>
                  <button type="button"
                    className={`theme-btn ${form.theme === "auto" ? "active" : ""}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "auto" }))}
                    title="Ativa o tema escuro automaticamente das 18h às 6h"
                  >
                    <Monitor size={14} /> Auto
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={t('settings.language')}>
            <div className="settings-option-group">
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Globe size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">{t('settings.language')}</div>
                    <div className="settings-option-desc">{t('settings.languageDesc')}</div>
                  </div>
                </div>
                <select className="control control-sm settings-select"
                  value={form.language}
                  onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as Language }))}>
                  <option value="pt">🇵🇹 Português</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>
              <div className="settings-divider" />
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Gauge size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">{t('settings.units')}</div>
                    <div className="settings-option-desc">{t('settings.unitsDesc')}</div>
                  </div>
                </div>
                <select className="control control-sm settings-select"
                  value={form.units}
                  onChange={(e) => setForm((p) => ({ ...p, units: e.target.value as AppSettings["units"] }))}>
                  <option value="metric">{t('settings.unitsMetric')}</option>
                  <option value="imperial">{t('settings.unitsImperial')}</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title={t('map.title')}>
            <div className="settings-option-group">
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Activity size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">{t('settings.mapStyle')}</div>
                    <div className="settings-option-desc">{t('settings.mapStyleDesc')}</div>
                  </div>
                </div>
                <select className="control control-sm settings-select"
                  value={form.mapStyle}
                  onChange={(e) => setForm((p) => ({ ...p, mapStyle: e.target.value as MapStyle }))}>
                  <option value="streets">{t('settings.mapStyleStreets')}</option>
                  <option value="satellite">{t('settings.mapStyleSatellite')}</option>
                </select>
              </div>
              <div className="settings-divider" />
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Activity size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">{t('settings.mapAutopilot')}</div>
                    <div className="settings-option-desc">{t('settings.mapAutopilotDesc')}</div>
                  </div>
                </div>
                <label className="settings-toggle">
                  <input type="checkbox"
                    checked={form.mapAutopilot}
                    onChange={(e) => setForm((p) => ({ ...p, mapAutopilot: e.target.checked }))} />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setForm(defaultSettings()); setMsg(null); }}>
              <RotateCcw size={14} /> {t('settings.resetDefault')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
              <Check size={14} /> {isSaving ? t('settings.saving') : t('common.save')}
            </button>
          </div>
        </form>
      )}

      {/* ── Alertas ── */}
      {activeTab === "alerts" && (
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 16 }}>
          <Card title="Notificações">
            <div className="settings-option-group">
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Bell size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">Guardar alertas em histórico</div>
                    <div className="settings-option-desc">Regista todos os alertas recebidos</div>
                  </div>
                </div>
                <label className="settings-toggle">
                  <input type="checkbox" checked={form.alerts.enabled}
                    onChange={(e) => setAlert("enabled", e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
              <div className="settings-divider" />
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Bell size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">Som ao receber alerta</div>
                    <div className="settings-option-desc">Reproduz um som quando chega um novo alerta</div>
                  </div>
                </div>
                <label className="settings-toggle">
                  <input type="checkbox" checked={form.alerts.soundEnabled}
                    onChange={(e) => setAlert("soundEnabled", e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
              <div className="settings-divider" />
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Check size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">Auto-reconhecer ao abrir</div>
                    <div className="settings-option-desc">Marca o alerta como lido ao expandir</div>
                  </div>
                </div>
                <label className="settings-toggle">
                  <input type="checkbox" checked={form.alerts.autoAckOnOpen}
                    onChange={(e) => setAlert("autoAckOnOpen", e.target.checked)} />
                  <span className="toggle-track" />
                </label>
              </div>
            </div>
          </Card>

          <Card title="Filtros & Limites">
            <div className="settings-option-group">
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Shield size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">Severidade mínima a registar</div>
                    <div className="settings-option-desc">Alertas abaixo deste nível são ignorados</div>
                  </div>
                </div>
                <select className="control control-sm settings-select"
                  value={form.alerts.minSeverity}
                  onChange={(e) => setAlert("minSeverity", e.target.value as AlertMinSeverity)}>
                  <option value="INFO">INFO — todos</option>
                  <option value="WARNING">WARNING e acima</option>
                  <option value="CRITICAL">Apenas CRITICAL</option>
                </select>
              </div>
              <div className="settings-divider" />
              <div className="settings-option-row">
                <div className="settings-option-info">
                  <Activity size={18} className="settings-option-icon" />
                  <div>
                    <div className="settings-option-label">Máx. alertas em histórico</div>
                    <div className="settings-option-desc">Alertas mais antigos são removidos automaticamente</div>
                  </div>
                </div>
                <input className="control control-sm settings-select" type="number"
                  min={10} max={2000} step={10} value={form.alerts.maxStored}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 10 && v <= 2000) setAlert("maxStored", v);
                  }} />
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
              <Check size={14} /> {isSaving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* ── Limiares ── */}
      {activeTab === "thresholds" && (
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 16 }}>
          <div className="settings-thresholds-info">
            <Shield size={14} />
            Os limiares definem quando os alertas são gerados. Aviso = amarelo, Crítico = vermelho.
          </div>

          {[
            {
              title: "Velocidade", icon: <Gauge size={16} />, unit: "km/h",
              fields: [
                { id: "t-speed-warn", label: "Aviso", field: "maxSpeedKmhWarn" as const, min: 60, max: 200, step: 5 },
                { id: "t-speed-crit", label: "Crítico", field: "maxSpeedKmhCrit" as const, min: 80, max: 300, step: 5 },
              ],
            },
            {
              title: "G-Force", icon: <Activity size={16} />, unit: "G",
              fields: [
                { id: "t-gf-warn", label: "Aviso", field: "maxGForceWarn" as const, min: 0.1, max: 5, step: 0.05 },
                { id: "t-gf-crit", label: "Crítico", field: "maxGForceCrit" as const, min: 0.1, max: 5, step: 0.05 },
              ],
            },
            {
              title: "Inclinação (Roll)", icon: <Sliders size={16} />, unit: "°",
              fields: [
                { id: "t-roll-warn", label: "Aviso", field: "maxRollDegWarn" as const, min: 10, max: 90, step: 1 },
                { id: "t-roll-crit", label: "Crítico", field: "maxRollDegCrit" as const, min: 10, max: 90, step: 1 },
              ],
            },
            {
              title: "Temperatura do Motor", icon: <Thermometer size={16} />, unit: "°C",
              fields: [
                { id: "t-temp-warn", label: "Aviso", field: "maxEngineTempCWarn" as const, min: 60, max: 200, step: 5 },
                { id: "t-temp-crit", label: "Crítico", field: "maxEngineTempCCrit" as const, min: 60, max: 200, step: 5 },
              ],
            },
          ].map(({ title, icon, unit, fields }) => (
            <Card key={title} title={title}>
              <div className="threshold-grid">
                {fields.map(({ id, label, field, min, max, step }) => (
                  <div key={field} className={`threshold-field ${label === "Aviso" ? "warn" : "crit"}`}>
                    <div className="threshold-label">
                      <span className={`threshold-dot ${label === "Aviso" ? "warn" : "crit"}`} />
                      {label}
                    </div>
                    <div className="threshold-input-row">
                      <input id={id} className="control" type="number" min={min} max={max} step={step}
                        value={form.thresholds[field]}
                        onChange={(e) => setThreshold(field, Number(e.target.value))} />
                      <span className="threshold-unit">{unit}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step}
                      value={form.thresholds[field]}
                      onChange={(e) => setThreshold(field, Number(e.target.value))}
                      className={`threshold-slider ${label === "Aviso" ? "warn" : "crit"}`} />
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost"
              onClick={() => setForm((p) => ({ ...p, thresholds: defaultThresholds() }))}>
              <RotateCcw size={14} /> Repor padrão
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
              <Check size={14} /> {isSaving ? "A guardar..." : "Guardar"}
            </button>
          </div>
        </form>
      )}

      {/* ── Sobre ── */}
      {activeTab === "about" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card title="MotoGuard IoT">
            <div className="about-info-grid">
              {[
                { label: "Aplicação", val: "MotoGuard IoT" },
                { label: "Versão", val: "1.0.0" },
                { label: "Ambiente", val: import.meta.env.MODE ?? "production" },
                { label: "API Base", val: "/api" },
                { label: "Utilizador", val: user?.email ?? "—" },
                { label: "Conta criada", val: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-PT") : "—" },
              ].map(({ label, val }) => (
                <div key={label} className="about-info-row">
                  <span className="about-info-key">{label}</span>
                  <span className="about-info-val">{val}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Tecnologias">
            <div className="tech-grid">
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
                <div key={name} className="tech-item">
                  <div className="tech-name">{name}</div>
                  <div className="tech-desc">{desc}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Privacidade & Dados">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
                As preferências e alertas são guardados localmente no teu browser via <code>localStorage</code>.
                Nenhum dado é partilhado com terceiros. Os dados de telemetria são processados localmente no servidor.
              </p>
              <div className="settings-danger-zone">
                <div className="settings-option-info">
                  <Trash2 size={18} style={{ color: "var(--red)" }} />
                  <div>
                    <div className="settings-option-label" style={{ color: "var(--red)" }}>Limpar dados locais</div>
                    <div className="settings-option-desc">Remove preferências, alertas e sessão guardada</div>
                  </div>
                </div>
                <button className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm("Apagar todos os dados locais? Esta ação é irreversível.")) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}>
                  <Trash2 size={14} /> Limpar
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
