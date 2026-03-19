import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card";
import {
  applyTheme,
  defaultSettings,
  loadSettings,
  saveSettings,
  type AppSettings,
} from "../utils/settings";

export default function Settings() {
  const [form, setForm] = useState<AppSettings>(() => loadSettings());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    document.title = "Settings — MotoGuard";
  }, []);

  useEffect(() => {
    applyTheme(form.theme);
  }, [form.theme]);

  const hasChanges = useMemo(() => {
    const current = loadSettings();
    return JSON.stringify(current) !== JSON.stringify(form);
  }, [form]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      saveSettings(form);
      setMsg({ type: "success", text: "Preferências guardadas." });
    } catch {
      setMsg({ type: "error", text: "Não foi possível guardar as preferências." });
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setForm(defaultSettings());
    setMsg(null);
  }

  return (
    <div className="page page-full">
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Settings</div>
          <div className="page-subtitle">Preferências do frontend</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={onReset} disabled={saving}>
            Repor
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => void onSave()} disabled={saving || !hasChanges}>
            {saving ? "A guardar..." : "Guardar"}
          </button>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-danger"}`}>
          {msg.text}
        </div>
      )}

      <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <Card title="Aparência" subtitle="Tema">
          <div className="field">
            <div className="field-label">Tema</div>
            <select
              className="control"
              value={form.theme}
              onChange={(e) => setForm((p) => ({ ...p, theme: e.target.value as AppSettings["theme"] }))}
            >
              <option value="light">Claro</option>
              <option value="dark">Escuro</option>
            </select>
          </div>
        </Card>

        <Card title="Unidades" subtitle="Como apresentar valores">
          <div className="field">
            <div className="field-label">Sistema</div>
            <select
              className="control"
              value={form.units}
              onChange={(e) => setForm((p) => ({ ...p, units: e.target.value as AppSettings["units"] }))}
            >
              <option value="metric">Métrico (km/h, °C)</option>
              <option value="imperial">Imperial (mph, °F)</option>
            </select>
          </div>
        </Card>

        <Card title="Alertas" subtitle="Preferências">
          <label className="auth-checkbox" style={{ alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={form.alerts.enabled}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  alerts: { ...p.alerts, enabled: e.target.checked },
                }))
              }
            />
            <span>Guardar alertas em histórico (para a página /alertas)</span>
          </label>

          <label className="auth-checkbox" style={{ alignItems: "center", gap: 10, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={form.alerts.autoAckOnOpen}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  alerts: { ...p.alerts, autoAckOnOpen: e.target.checked },
                }))
              }
            />
            <span>Ao abrir um alerta, marcar automaticamente como reconhecido</span>
          </label>
        </Card>

        <Card title="Sistema" subtitle="Info">
          <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <div className="tile">
              <div className="tile-k">Versão</div>
              <div className="tile-v">Frontend</div>
            </div>
            <div className="tile">
              <div className="tile-k">Tema ativo</div>
              <div className="tile-v">{form.theme}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
