import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import {
  loadAlerts,
  saveAlerts,
  ALERT_TYPE_LABELS,
  type AlertItem,
  type AlertSeverity,
  type AlertStatus,
  type AlertType,
} from "../utils/alerts";
import { loadSettings } from "../utils/settings";

type StatusFilter = "all" | "unread" | "ack";
type SeverityFilter = "all" | "INFO" | "WARNING" | "CRITICAL";
type TypeFilter = "all" | AlertType;
type ViewMode = "list" | "timeline";

const PAGE_SIZE = 20;

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
    case "CRITICAL": return "var(--red)";
    case "WARNING": return "var(--yellow)";
    default: return "var(--muted)";
  }
}

function severityDotColor(sev: AlertItem["severity"]) {
  switch (sev) {
    case "CRITICAL": return "#ef4444";
    case "WARNING": return "#f59e0b";
    default: return "#3b82f6";
  }
}

function typeIcon(type?: AlertType): string {
  switch (type) {
    case "SPEED": return "🚀";
    case "BRAKING": return "🛑";
    case "TILT": return "↗️";
    case "ENGINE": return "🔧";
    case "BATTERY": return "🔋";
    case "GEOFENCE": return "📍";
    case "IMPACT": return "💥";
    case "MAINTENANCE": return "🔩";
    default: return "⚠️";
  }
}

export default function Alertas() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>(() => loadAlerts());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    document.title = "Alertas & Eventos — MotoGuard";
  }, []);

  useEffect(() => {
    const onUpdate = () => setAlerts(loadAlerts());
    window.addEventListener("motoguard:alerts", onUpdate);
    return () => window.removeEventListener("motoguard:alerts", onUpdate);
  }, []);

  const devices = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => { if (a.deviceId) set.add(a.deviceId); });
    return Array.from(set).sort();
  }, [alerts]);

  const types = useMemo(() => {
    const set = new Set<AlertType>();
    alerts.forEach((a) => { if (a.type) set.add(a.type); });
    return Array.from(set).sort();
  }, [alerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return alerts
      .filter((a) => status === "all" || a.status === status)
      .filter((a) => severity === "all" || a.severity === severity)
      .filter((a) => type === "all" || a.type === type)
      .filter((a) => deviceFilter === "all" || a.deviceId === deviceFilter)
      .filter((a) => {
        if (fromTs && new Date(a.timestamp).getTime() < fromTs) return false;
        if (toTs && new Date(a.timestamp).getTime() > toTs) return false;
        return true;
      })
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
  }, [alerts, query, severity, status, type, deviceFilter, dateFrom, dateTo]);

  useEffect(() => {
    setPage(1);
  }, [query, status, severity, type, deviceFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return alerts.find((a) => a.id === selectedId) ?? null;
  }, [alerts, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const settings = loadSettings();
    if (!settings.alerts.autoAckOnOpen) return;
    const current = alerts.find((a) => a.id === selectedId);
    if (!current || current.status !== "unread") return;
    const out = alerts.map<AlertItem>((a) =>
      a.id === selectedId ? { ...a, status: "ack" as AlertStatus } : a,
    );
    setAlerts(out);
    saveAlerts(out);
  }, [alerts, selectedId]);

  function setAlert(next: AlertItem) {
    const out = alerts.map((a) => (a.id === next.id ? next : a));
    setAlerts(out);
    saveAlerts(out);
  }

  function clearFilters() {
    setStatus("all");
    setSeverity("all");
    setType("all");
    setDeviceFilter("all");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  }

  const hasFilters = status !== "all" || severity !== "all" || type !== "all" || deviceFilter !== "all" || dateFrom || dateTo || query;

  return (
    <div className="page page-full">
      <div className="page-header">
        <div>
          <div className="page-title">🔔 Alertas & Eventos</div>
          <div className="page-subtitle">
            {alerts.filter((a) => a.status === "unread").length} por ler
            &nbsp;·&nbsp; {filtered.length} filtrados
          </div>
        </div>
        <div className="page-actions">
          <button
            className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            Lista
          </button>
          <button
            className={`btn btn-sm ${viewMode === "timeline" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setViewMode("timeline")}
            aria-pressed={viewMode === "timeline"}
          >
            Timeline
          </button>
        </div>
      </div>

      <div className="alerts-grid">
        <Card title="Filtros & Lista" subtitle="Recentes">
          <div style={{ display: "grid", gap: 10 }}>
            {/* Linha 1: pesquisa + status + severidade */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="control"
                placeholder="Pesquisar..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ flex: 1, minWidth: 160 }}
                aria-label="Pesquisar alertas"
              />
              <select
                className="control"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
                style={{ width: 140 }}
                aria-label="Filtrar por estado"
              >
                <option value="all">Todos</option>
                <option value="unread">Por ler</option>
                <option value="ack">Reconhecidos</option>
              </select>
              <select
                className="control"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
                style={{ width: 140 }}
                aria-label="Filtrar por severidade"
              >
                <option value="all">Severidade</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            </div>

            {/* Linha 2: tipo + device + período */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                className="control"
                value={type}
                onChange={(e) => setType(e.target.value as TypeFilter)}
                style={{ width: 150 }}
                aria-label="Filtrar por tipo"
              >
                <option value="all">Tipo</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {typeIcon(t)} {ALERT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              {devices.length > 0 && (
                <select
                  className="control"
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                  style={{ width: 150 }}
                  aria-label="Filtrar por dispositivo"
                >
                  <option value="all">Todos os devices</option>
                  {devices.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              <input
                className="control"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{ width: 145 }}
                aria-label="Data de início"
                title="De"
              />
              <input
                className="control"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{ width: 145 }}
                aria-label="Data de fim"
                title="Até"
              />
              {hasFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters} aria-label="Limpar filtros">
                  Limpar
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: 22 }}>
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-title">Sem alertas</div>
                <div className="empty-state-text">
                  Quando o sistema emitir alertas, vão aparecer aqui.
                </div>
              </div>
            ) : viewMode === "list" ? (
              <>
                <div
                  role="list"
                  aria-label="Lista de alertas"
                  aria-live="polite"
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {paginated.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="listitem"
                      aria-pressed={selectedId === a.id}
                      aria-label={`${a.title} — ${a.severity} — ${a.status === "unread" ? "Por ler" : "Reconhecido"}`}
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
                          <div style={{ fontWeight: 800, fontSize: 14 }}>
                            {typeIcon(a.type)} {a.title}
                          </div>
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
                          {a.type ? ` · ${ALERT_TYPE_LABELS[a.type]}` : ""}
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

                {totalPages > 1 && (
                  <div
                    role="navigation"
                    aria-label="Paginação de alertas"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 8 }}
                  >
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Página anterior"
                    >
                      ‹ Anterior
                    </button>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>
                      {page} / {totalPages} &nbsp;·&nbsp; {filtered.length} alertas
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      aria-label="Próxima página"
                    >
                      Próxima ›
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Timeline view */
              <div style={{ position: "relative", paddingLeft: 24 }}>
                <div style={{
                  position: "absolute",
                  left: 8,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "var(--border)",
                  borderRadius: 2,
                }} />
                {paginated.map((a) => (
                  <div
                    key={a.id}
                    style={{ position: "relative", marginBottom: 18, cursor: "pointer" }}
                    onClick={() => setSelectedId(a.id)}
                  >
                    <div style={{
                      position: "absolute",
                      left: -20,
                      top: 4,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: severityDotColor(a.severity),
                      border: "2px solid var(--surface)",
                      zIndex: 1,
                    }} />
                    <div
                      className="subpanel"
                      style={{
                        border: selectedId === a.id ? "1px solid rgba(79,70,229,0.4)" : "1px solid var(--border)",
                        background: selectedId === a.id ? "rgba(79,70,229,0.04)" : undefined,
                        borderRadius: 10,
                        padding: "10px 14px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {typeIcon(a.type)} {a.title}
                        </div>
                        <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {formatDateTime(a.timestamp)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {a.message}
                      </div>
                    </div>
                  </div>
                ))}
                {totalPages > 1 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{page}/{totalPages}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Detalhe">
          <div aria-live="polite" aria-atomic="true">
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
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {typeIcon(selected.type)} {selected.title}
                    </div>
                    <div className="page-subtitle" style={{ margin: 0 }}>
                      {formatDateTime(selected.timestamp)}
                      {selected.motoModel ? ` · ${selected.motoModel}` : ""}
                      {selected.deviceId ? ` · ${selected.deviceId}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span
                      className="badge-pill"
                      style={{ background: "rgba(17,24,39,0.03)", color: severityColor(selected.severity) }}
                    >
                      {selected.severity}
                    </span>
                    {selected.type && (
                      <span className="badge-pill" style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1" }}>
                        {ALERT_TYPE_LABELS[selected.type]}
                      </span>
                    )}
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

                {/* Ações: ver no mapa / ver viagem */}
                {(selected.lat != null || selected.tripId) && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {selected.lat != null && selected.lng != null && (
                      <a
                        href={`https://maps.google.com/?q=${selected.lat},${selected.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Ver no mapa (Google Maps)
                      </a>
                    )}
                    {selected.lat != null && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/map`)}
                      >
                        Ver no mapa
                      </button>
                    )}
                    {selected.tripId && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/trips/${selected.tripId}`)}
                      >
                        Ver viagem completa
                      </button>
                    )}
                  </div>
                )}

                {/* Coordenadas */}
                {selected.lat != null && selected.lng != null && (
                  <div className="subpanel">
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Localização</div>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>
                      Lat: {selected.lat.toFixed(6)} &nbsp; Lng: {selected.lng.toFixed(6)}
                    </div>
                  </div>
                )}

                {selected.meta && (
                  <div className="subpanel">
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Métricas no momento</div>
                    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, color: "var(--muted)" }}>
                      {JSON.stringify(selected.meta, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
