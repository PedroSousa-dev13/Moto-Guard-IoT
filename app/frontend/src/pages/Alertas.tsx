import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/ui/Card";
import { loadAlerts, saveAlerts, type AlertItem } from "../utils/alerts";
import { loadSettings } from "../utils/settings";

type StatusFilter = "all" | "unread" | "ack";
type SeverityFilter = "all" | "INFO" | "WARNING" | "CRITICAL";

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function severityColor(sev: AlertItem["severity"]) {
  switch (sev) {
    case "CRITICAL":
      return "var(--red)";
    case "WARNING":
      return "var(--yellow)";
    default:
      return "var(--muted)";
  }
}

export default function Alertas() {
  const [alerts, setAlerts] = useState<AlertItem[]>(() => loadAlerts());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    document.title = "Alertas — MotoGuard";
  }, []);

  useEffect(() => {
    const onUpdate = () => setAlerts(loadAlerts());
    window.addEventListener("motoguard:alerts", onUpdate);
    return () => window.removeEventListener("motoguard:alerts", onUpdate);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts
      .filter((a) => (status === "all" ? true : a.status === status))
      .filter((a) => (severity === "all" ? true : a.severity === severity))
      .filter((a) => {
        if (!q) return true;
        return (
          a.title.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          (a.deviceId ?? "").toLowerCase().includes(q) ||
          (a.motoModel ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, query, severity, status]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return alerts.find((a) => a.id === selectedId) ?? null;
  }, [alerts, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const settings = loadSettings();
    if (!settings.alerts.autoAckOnOpen) return;
    const current = alerts.find((a) => a.id === selectedId);
    if (!current) return;
    if (current.status !== "unread") return;
    const out = alerts.map<AlertItem>((a) =>
      a.id === selectedId ? { ...a, status: "ack" as AlertItem["status"] } : a,
    );
    setAlerts(out);
    saveAlerts(out);
  }, [alerts, selectedId]);

  function setAlert(next: AlertItem) {
    const out = alerts.map((a) => (a.id === next.id ? next : a));
    setAlerts(out);
    saveAlerts(out);
  }

  return (
    <div className="page page-full">
      <div className="page-header">
        <div>
          <div className="page-title">🔔 Alertas</div>
          <div className="page-subtitle">
            {alerts.filter((a) => a.status === "unread").length} por ler
          </div>
        </div>
      </div>

      <div className="alerts-grid">
        <Card title="Lista" subtitle="Recentes">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="control"
                placeholder="Pesquisar..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, minWidth: 180 }}
              />
              <select
                className="control"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                style={{ width: 150 }}
              >
                <option value="all">Todos</option>
                <option value="unread">Por ler</option>
                <option value="ack">Reconhecidos</option>
              </select>
              <select
                className="control"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
                style={{ width: 150 }}
              >
                <option value="all">Severidade</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: 22 }}>
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-title">Sem alertas</div>
                <div className="empty-state-text">
                  Quando o sistema emitir alertas, vão aparecer aqui.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflow: "auto" }}>
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className="trip-summary"
                    style={{
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "12px 14px",
                      background: selectedId === a.id ? "rgba(79,70,229,0.06)" : "var(--surface)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{a.title}</div>
                        <span
                          className="badge-pill"
                          style={{ background: "rgba(17,24,39,0.03)", color: severityColor(a.severity) }}
                        >
                          {a.severity}
                        </span>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        {formatDateTime(a.timestamp)}
                        {a.deviceId ? ` · ${a.deviceId}` : ""}
                      </div>
                      <div style={{ color: "var(--text)", fontSize: 13, opacity: 0.9 }}>
                        {a.message}
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <span
                          className="badge-pill"
                          style={{
                            background: a.status === "unread" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)",
                            color: a.status === "unread" ? "#ef4444" : "#22c55e",
                          }}
                        >
                          {a.status === "unread" ? "Por ler" : "Reconhecido"}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title="Detalhe">
          {!selected ? (
            <div className="empty-state" style={{ padding: 22 }}>
              <div className="empty-state-icon">🧾</div>
              <div className="empty-state-title">Seleciona um alerta</div>
              <div className="empty-state-text">Escolhe um item na lista para ver detalhes.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>{selected.title}</div>
                  <div className="page-subtitle" style={{ margin: 0 }}>
                    {formatDateTime(selected.timestamp)}
                    {selected.motoModel ? ` · ${selected.motoModel}` : ""}
                    {selected.deviceId ? ` · ${selected.deviceId}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    className="badge-pill"
                    style={{ background: "rgba(17,24,39,0.03)", color: severityColor(selected.severity) }}
                  >
                    {selected.severity}
                  </span>
                  <button
                    className={`btn btn-sm ${selected.status === "unread" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setAlert({ ...selected, status: selected.status === "unread" ? "ack" : "unread" })}
                  >
                    {selected.status === "unread" ? "Reconhecer" : "Marcar por ler"}
                  </button>
                </div>
              </div>
              <div className="subpanel">
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Mensagem</div>
                <div style={{ color: "var(--text)", opacity: 0.9 }}>{selected.message}</div>
              </div>
              {selected.meta && (
                <div className="subpanel">
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Contexto</div>
                  <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "var(--muted)" }}>
                    {JSON.stringify(selected.meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
