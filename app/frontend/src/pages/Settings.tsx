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
      <div className="glass-panel" style={{ padding: '4px', display: 'flex', gap: '4px', marginBottom: '24px', borderRadius: '14px' }}>
        {TABS.map((tab) => (
          <button key={tab.id} role="tab" aria-selected={activeTab === tab.id}
            className={`btn ${activeTab === tab.id ? "btn-primary" : "btn-ghost"}`}
            style={{ flex: 1, padding: '10px', borderRadius: '10px' }}
            onClick={() => { setActiveTab(tab.id); setMsg(null); }}>
            {tab.icon} <span style={{ marginLeft: '8px' }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {msg && (
        <div role="status" aria-live="polite" className={`alert ${msg.type === "success" ? "alert-success" : "alert-danger"}`} style={{ marginBottom: '20px' }}>
          {msg.text}
        </div>
      )}

      {/* ── Preferências ── */}
      {activeTab === "prefs" && (
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 20 }}>

          <Card title={t('settings.appearance')} className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Sun size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t('settings.theme')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('settings.themeLight')} / {t('settings.themeDark')} / Auto (18h-6h)</div>
                  </div>
                </div>
                <div className="glass-panel" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '10px' }}>
                  <button type="button"
                    className={`btn btn-sm ${form.theme === "light" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "light" }))}>
                    <Sun size={14} />
                  </button>
                  <button type="button"
                    className={`btn btn-sm ${form.theme === "dark" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "dark" }))}>
                    <Moon size={14} />
                  </button>
                  <button type="button"
                    className={`btn btn-sm ${form.theme === "auto" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setForm((p) => ({ ...p, theme: "auto" }))}
                    title="Auto (18h-6h)">
                    <Monitor size={14} />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={t('settings.language')} className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Globe size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t('settings.language')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('settings.languageDesc')}</div>
                  </div>
                </div>
                <select className="control" style={{ width: '160px' }}
                  value={form.language}
                  onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as Language }))}>
                  <option value="pt">🇵🇹 Português</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Gauge size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t('settings.units')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('settings.unitsDesc')}</div>
                  </div>
                </div>
                <select className="control" style={{ width: '160px' }}
                  value={form.units}
                  onChange={(e) => setForm((p) => ({ ...p, units: e.target.value as AppSettings["units"] }))}>
                  <option value="metric">{t('settings.unitsMetric')}</option>
                  <option value="imperial">{t('settings.unitsImperial')}</option>
                </select>
              </div>
            </div>
          </Card>

          <Card title={t('map.title')} className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Activity size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t('settings.mapStyle')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('settings.mapStyleDesc')}</div>
                  </div>
                </div>
                <select className="control" style={{ width: '160px' }}
                  value={form.mapStyle}
                  onChange={(e) => setForm((p) => ({ ...p, mapStyle: e.target.value as MapStyle }))}>
                  <option value="streets">{t('settings.mapStyleStreets')}</option>
                  <option value="satellite">{t('settings.mapStyleSatellite')}</option>
                </select>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Activity size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{t('settings.mapAutopilot')}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('settings.mapAutopilotDesc')}</div>
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

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: '8px' }}>
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
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 20 }}>
          <Card title="Notificações" className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { icon: <Bell size={18} />, label: "Guardar alertas em histórico", desc: "Regista todos os alertas recebidos", field: "enabled" },
                { icon: <Bell size={18} />, label: "Som ao receber alerta", desc: "Reproduz um som quando chega um novo alerta", field: "soundEnabled" },
                { icon: <Check size={18} />, label: "Auto-reconhecer ao abrir", desc: "Marca o alerta como lido ao expandir", field: "autoAckOnOpen" }
              ].map((item, i) => (
                <div key={item.field}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div className="tile-icon tile-icon-blue">{item.icon}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{item.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.desc}</div>
                      </div>
                    </div>
                    <label className="settings-toggle">
                      <input type="checkbox" checked={form.alerts[item.field as keyof AppSettings["alerts"]] as boolean}
                        onChange={(e) => setAlert(item.field as any, e.target.checked)} />
                      <span className="toggle-track" />
                    </label>
                  </div>
                  {i < 2 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginTop: '16px' }} />}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Filtros & Limites" className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Shield size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Severidade mínima a registar</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Alertas abaixo deste nível são ignorados</div>
                  </div>
                </div>
                <select className="control" style={{ width: '180px' }}
                  value={form.alerts.minSeverity}
                  onChange={(e) => setAlert("minSeverity", e.target.value as AlertMinSeverity)}>
                  <option value="INFO">INFO — todos</option>
                  <option value="WARNING">WARNING e acima</option>
                  <option value="CRITICAL">Apenas CRITICAL</option>
                </select>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon tile-icon-blue"><Activity size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Máx. alertas em histórico</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Alertas mais antigos são removidos automaticamente</div>
                  </div>
                </div>
                <input className="control" style={{ width: '100px' }} type="number"
                  min={10} max={2000} step={10} value={form.alerts.maxStored}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v >= 10 && v <= 2000) setAlert("maxStored", v);
                  }} />
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
              <Check size={14} /> {isSaving ? "A guardar..." : "Guardar Alterações"}
            </button>
          </div>
        </form>
      )}

      {/* ── Limiares ── */}
      {activeTab === "thresholds" && (
        <form onSubmit={(e) => void handleSave(e)} style={{ display: "grid", gap: 20 }}>
          <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <Shield size={18} className="accent-purple" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-2)' }}>
              Os limiares definem quando os alertas são gerados. Aviso = amarelo, Crítico = vermelho.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
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
              <Card key={title} title={title} className="glass-panel">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {fields.map(({ id, label, field, min, max, step }) => (
                    <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 800, color: label === "Aviso" ? 'var(--yellow)' : 'var(--red)' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
                          {label}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input id={id} className="control" style={{ width: '70px', padding: '4px 8px', textAlign: 'center' }} type="number" min={min} max={max} step={step}
                            value={form.thresholds[field]}
                            onChange={(e) => setThreshold(field, Number(e.target.value))} />
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>{unit}</span>
                        </div>
                      </div>
                      <input type="range" min={min} max={max} step={step}
                        value={form.thresholds[field]}
                        onChange={(e) => setThreshold(field, Number(e.target.value))}
                        style={{ accentColor: label === "Aviso" ? 'var(--yellow)' : 'var(--red)' }} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: '8px' }}>
            <button type="button" className="btn btn-ghost"
              onClick={() => setForm((p) => ({ ...p, thresholds: defaultThresholds() }))}>
              <RotateCcw size={14} /> Repor padrão
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
              <Check size={14} /> {isSaving ? "A guardar..." : "Guardar Alterações"}
            </button>
          </div>
        </form>
      )}

      {/* ── Sobre ── */}
      {activeTab === "about" && (
        <div style={{ display: "grid", gap: 20 }}>
          <Card title="MotoGuard IoT" className="glass-panel">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: "Aplicação", val: "MotoGuard IoT" },
                { label: "Versão", val: "1.0.0" },
                { label: "Ambiente", val: import.meta.env.MODE ?? "production" },
                { label: "API Base", val: "/api" },
                { label: "Utilizador", val: user?.email ?? "—" },
                { label: "Conta criada", val: user?.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-PT") : "—" },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '4px 0' }}>
                  <span style={{ color: "var(--muted)", fontWeight: 600 }}>{label}</span>
                  <span style={{ color: "var(--text)", fontWeight: 800 }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Tecnologias" className="glass-panel">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: '12px' }}>
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
                <div key={name} className="subpanel" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '2px' }}>{name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{desc}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Privacidade & Dados" className="glass-panel">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <p style={{ fontSize: "0.875rem", color: "var(--text-2)", margin: 0, lineHeight: 1.6 }}>
                As preferências e alertas são guardados localmente no teu browser via <code>localStorage</code>.
                Nenhum dado é partilhado com terceiros. Os dados de telemetria são processados localmente no servidor.
              </p>
              <div className="subpanel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div className="tile-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)' }}><Trash2 size={18} /></div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--red)' }}>Limpar dados locais</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Remove preferências, alertas e sessão guardada</div>
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
