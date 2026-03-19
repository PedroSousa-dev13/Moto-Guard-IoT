import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { authAPI } from "../services/api";
import {
  applyTheme,
  defaultSettings,
  defaultThresholds,
  loadSettings,
  saveSettings,
  type AlertMinSeverity,
  type AppSettings,
  type Language,
} from "../utils/settings";

type Tab = "prefs" | "alerts" | "profile" | "thresholds" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "prefs", label: "Preferências" },
  { id: "alerts", label: "Alertas" },
  { id: "profile", label: "Perfil" },
  { id: "thresholds", label: "Limiares" },
  { id: "about", label: "Sobre" },
];

interface Msg { type: "success" | "error"; text: string }

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("prefs");
  const [form, setForm] = useState<AppSettings>(() => loadSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    document.title = "Definições — MotoGuard";
  }, []);

  useEffect(() => {
    if (user?.name) setProfileName(user.name);
  }, [user]);

  const isDirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(loadSettings());
  }, [form]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setMsg(null);
    try {
      saveSettings(form);
      applyTheme(form.theme);
      setMsg({ type: "success", text: "Definições guardadas com sucesso." });
    } catch {
      setMsg({ type: "error", text: "Erro ao guardar definições." });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      if (profileName !== user?.name) {
        await authAPI.updateProfile({ name: profileName });
      }
      if (newPassword && currentPassword) {
        await authAPI.changePassword(currentPassword, newPassword);
        setCurrentPassword("");
        setNewPassword("");
      }
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso." });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.response?.data?.error ?? "Erro ao atualizar perfil." });
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleReset() {
    setForm(defaultSettings());
    setMsg(null);
  }

  function handleResetThresholds() {
    setForm((p) => ({ ...p, thresholds: defaultThresholds() }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Definições</div>
          <div className="page-subtitle">Preferências da aplicação</div>
        </div>
      </div>

      {/* Tabs nav */}
      <div
        role="tablist"
        aria-label="Secções de definições"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "2px solid var(--border)",
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => { setActiveTab(tab.id); setMsg(null); }}
            style={{
              padding: "8px 18px",
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 700 : 400,
              background: "none",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
              marginBottom: -2,
              cursor: "pointer",
              color: activeTab === tab.id ? "#4f46e5" : "var(--text)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Preferências */}
      {activeTab === "prefs" && (
        <form onSubmit={(e) => void handleSave(e)}>
          <div style={{ display: "grid", gap: 16 }}>
            {msg && (
              <div role="status" aria-live="polite" className={`alert ${msg.type === "success" ? "alert-success" : "alert-danger"}`}>
                {msg.text}
              </div>
            )}

            <Card title="Aparência" subtitle="Tema">
              <div className="field">
                <label className="field-label" htmlFor="settings-theme">Tema</label>
                <select
                  id="settings-theme"
                  className="control"
                  value={form.theme}
                  onChange={(e) => setForm((p) => ({ ...p, theme: e.target.value as AppSettings["theme"] }))}
                >
                  <option value="light">Claro</option>
                  <option value="dark">Escuro</option>
                </select>
              </div>
            </Card>

            <Card title="Unidades & Idioma">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="settings-units">Sistema</label>
                  <select
                    id="settings-units"
                    className="control"
                    value={form.units}
                    onChange={(e) => setForm((p) => ({ ...p, units: e.target.value as AppSettings["units"] }))}
                  >
                    <option value="metric">Métrico (km/h, °C)</option>
                    <option value="imperial">Imperial (mph, °F)</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="settings-language">Idioma</label>
                  <select
                    id="settings-language"
                    className="control"
                    value={form.language}
                    onChange={(e) => setForm((p) => ({ ...p, language: e.target.value as Language }))}
                  >
                    <option value="pt">Português</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>
            </Card>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={handleReset}>
                Repor padrão
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
                {isSaving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab: Alertas */}
      {activeTab === "alerts" && (
        <form onSubmit={(e) => void handleSave(e)}>
          <div style={{ display: "grid", gap: 16 }}>
            {msg && (
              <div role="status" aria-live="polite" className={`alert ${msg.type === "success" ? "alert-success" : "alert-danger"}`}>
                {msg.text}
              </div>
            )}

            <Card title="Alertas" subtitle="Preferências avançadas">
              <div style={{ display: "grid", gap: 14 }}>
                <label className="auth-checkbox" style={{ alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.alerts.enabled}
                    onChange={(e) => setForm((p) => ({ ...p, alerts: { ...p.alerts, enabled: e.target.checked } }))}
                  />
                  <span>Guardar alertas em histórico</span>
                </label>

                <label className="auth-checkbox" style={{ alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.alerts.autoAckOnOpen}
                    onChange={(e) => setForm((p) => ({ ...p, alerts: { ...p.alerts, autoAckOnOpen: e.target.checked } }))}
                  />
                  <span>Ao abrir um alerta, marcar automaticamente como reconhecido</span>
                </label>

                <label className="auth-checkbox" style={{ alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.alerts.soundEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, alerts: { ...p.alerts, soundEnabled: e.target.checked } }))}
                  />
                  <span>Som ao receber novo alerta</span>
                </label>

                <div className="form-grid">
                  <div className="field">
                    <label className="field-label" htmlFor="settings-min-severity">Severidade mínima a registar</label>
                    <select
                      id="settings-min-severity"
                      className="control"
                      value={form.alerts.minSeverity}
                      onChange={(e) => setForm((p) => ({ ...p, alerts: { ...p.alerts, minSeverity: e.target.value as AlertMinSeverity } }))}
                    >
                      <option value="INFO">INFO (todos)</option>
                      <option value="WARNING">WARNING e acima</option>
                      <option value="CRITICAL">Apenas CRITICAL</option>
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="settings-max-stored">Máx. alertas em histórico</label>
                    <input
                      id="settings-max-stored"
                      className="control"
                      type="number"
                      min={10}
                      max={2000}
                      step={10}
                      value={form.alerts.maxStored}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v >= 10 && v <= 2000) {
                          setForm((p) => ({ ...p, alerts: { ...p.alerts, maxStored: v } }));
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
                {isSaving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab: Perfil */}
      {activeTab === "profile" && (
        <form onSubmit={(e) => void handleSaveProfile(e)}>
          <div style={{ display: "grid", gap: 16 }}>
            {profileMsg && (
              <div role="status" aria-live="polite" className={`alert ${profileMsg.type === "success" ? "alert-success" : "alert-danger"}`}>
                {profileMsg.text}
              </div>
            )}

            <Card title="Dados do Perfil">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="profile-name">Nome</label>
                  <input
                    id="profile-name"
                    className="control"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="O teu nome"
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="profile-email">Email</label>
                  <input
                    id="profile-email"
                    className="control"
                    value={profileEmail}
                    readOnly
                    disabled
                    style={{ opacity: 0.6 }}
                  />
                </div>
              </div>
            </Card>

            <Card title="Alterar Password" subtitle="Deixa em branco para não alterar">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="profile-cur-pw">Password atual</label>
                  <input
                    id="profile-cur-pw"
                    className="control"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="profile-new-pw">Nova password</label>
                  <input
                    id="profile-new-pw"
                    className="control"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={newPassword ? 6 : undefined}
                  />
                </div>
              </div>
            </Card>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="btn btn-primary" disabled={isSavingProfile}>
                {isSavingProfile ? "A guardar..." : "Guardar perfil"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab: Limiares */}
      {activeTab === "thresholds" && (
        <form onSubmit={(e) => void handleSave(e)}>
          <div style={{ display: "grid", gap: 16 }}>
            {msg && (
              <div role="status" aria-live="polite" className={`alert ${msg.type === "success" ? "alert-success" : "alert-danger"}`}>
                {msg.text}
              </div>
            )}

            <Card title="Velocidade (km/h)">
              <div className="form-grid">
                {[
                  { id: "t-speed-warn", label: "Aviso", field: "maxSpeedKmhWarn" as const, min: 60, max: 200 },
                  { id: "t-speed-crit", label: "Crítico", field: "maxSpeedKmhCrit" as const, min: 80, max: 300 },
                ].map(({ id, label, field, min, max }) => (
                  <div className="field" key={field}>
                    <label className="field-label" htmlFor={id}>{label}</label>
                    <input
                      id={id}
                      className="control"
                      type="number"
                      min={min}
                      max={max}
                      step={5}
                      value={form.thresholds[field]}
                      onChange={(e) => setForm((p) => ({ ...p, thresholds: { ...p.thresholds, [field]: Number(e.target.value) } }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="G-Force (g)">
              <div className="form-grid">
                {[
                  { id: "t-gf-warn", label: "Aviso", field: "maxGForceWarn" as const, min: 0.1, max: 5, step: 0.05 },
                  { id: "t-gf-crit", label: "Crítico", field: "maxGForceCrit" as const, min: 0.1, max: 5, step: 0.05 },
                ].map(({ id, label, field, min, max, step }) => (
                  <div className="field" key={field}>
                    <label className="field-label" htmlFor={id}>{label}</label>
                    <input
                      id={id}
                      className="control"
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={form.thresholds[field]}
                      onChange={(e) => setForm((p) => ({ ...p, thresholds: { ...p.thresholds, [field]: Number(e.target.value) } }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Inclinação (graus)">
              <div className="form-grid">
                {[
                  { id: "t-roll-warn", label: "Aviso", field: "maxRollDegWarn" as const, min: 10, max: 90 },
                  { id: "t-roll-crit", label: "Crítico", field: "maxRollDegCrit" as const, min: 10, max: 90 },
                ].map(({ id, label, field, min, max }) => (
                  <div className="field" key={field}>
                    <label className="field-label" htmlFor={id}>{label}</label>
                    <input
                      id={id}
                      className="control"
                      type="number"
                      min={min}
                      max={max}
                      step={1}
                      value={form.thresholds[field]}
                      onChange={(e) => setForm((p) => ({ ...p, thresholds: { ...p.thresholds, [field]: Number(e.target.value) } }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Temperatura do Motor (°C)">
              <div className="form-grid">
                {[
                  { id: "t-temp-warn", label: "Aviso", field: "maxEngineTempCWarn" as const, min: 60, max: 200 },
                  { id: "t-temp-crit", label: "Crítico", field: "maxEngineTempCCrit" as const, min: 60, max: 200 },
                ].map(({ id, label, field, min, max }) => (
                  <div className="field" key={field}>
                    <label className="field-label" htmlFor={id}>{label}</label>
                    <input
                      id={id}
                      className="control"
                      type="number"
                      min={min}
                      max={max}
                      step={5}
                      value={form.thresholds[field]}
                      onChange={(e) => setForm((p) => ({ ...p, thresholds: { ...p.thresholds, [field]: Number(e.target.value) } }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={handleResetThresholds}>
                Repor padrão
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSaving || !isDirty}>
                {isSaving ? "A guardar..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Tab: Sobre */}
      {activeTab === "about" && (
        <div style={{ display: "grid", gap: 16 }}>
          <Card title="Sobre o MotoGuard IoT">
            <div style={{ display: "grid", gap: 10 }}>
              {[
                { label: "Aplicação", val: "MotoGuard IoT" },
                { label: "Versão", val: "1.0.0" },
                { label: "Ambiente", val: import.meta.env.MODE ?? "production" },
                { label: "API Base", val: "/api" },
              ].map(({ label, val }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: 13 }}>{label}</span>
                  <span style={{ fontSize: 13 }}>{val}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Privacidade & Dados" subtitle="Gestão dos teus dados locais">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                Os dados de alertas e preferências são guardados localmente no teu browser.
                Nenhum dado é partilhado com terceiros.
              </p>
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: "flex-start", color: "#ef4444", borderColor: "#ef4444" }}
                onClick={() => {
                  if (window.confirm("Apagar todos os dados locais? Esta ação é irreversível.")) {
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
              >
                Limpar todos os dados locais
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
