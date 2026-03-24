import { useEffect, useMemo, useState, useCallback } from "react";
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
import { alertsAPI } from "../services/api";
import { useNotifications } from "../hooks/useNotifications";
import { RefreshCw } from "lucide-react";

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
  const { markAllRead } = useNotifications();
  const [alerts, setAlerts] = useState<AlertItem[]>(() => loadAlerts());
  const [backendAlerts, setBackendAlerts] = useState<AlertItem[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
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

  // Carregar histórico persistido do backend
  const loadBackendAlerts = useCallback(async () => {
    setBackendLoading(true);
    setBackendError(null);
    try {
      const res = await alertsAPI.getAll({ limit: 200 });
      const mapped: AlertItem[] = res.data.map((ev: any) => ({
        id: `backend:${ev.id}`,
        title: ev.type.replace(/_/g, " "),
        message: ev.message ?? ev.type,
        severity: ev.severity as AlertSeverity,
        status: "ack" as AlertStatus, // eventos do backend já são histórico
        timestamp: ev.occurredAt,
        deviceId: ev.trip?.motorcycle?.deviceId ?? undefined,
        motoModel: ev.trip?.motorcycle?.name ?? undefined,
        tripId: ev.tripId,
        lat: ev.latitude ?? undefined,
        lng: ev.longitude ?? undefined,
        meta: {
          speedKmh: ev.speedKmh,
          rollDeg: ev.rollDeg,
          gForce: ev.gForce,
          engineTempC: ev.engineTempC,
          voltage: ev.voltage,
          source: ev.trip?.source,
        },
      }));
      setBackendAlerts(mapped);
    } catch {
      setBackendError("Não foi possível carregar o histórico do servidor.");
    } finally {
      setBackendLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackendAlerts();
  }, [loadBackendAlerts]);

  useEffect(() => {
    document.title = "Alertas & Eventos — MotoGuard";
  }, []);

  // Subscrever eventos Socket.IO em tempo real
  useEffect(() => {
    const onUpdate = () => setAlerts(loadAlerts());
    window.addEventListener("motoguard:alerts", onUpdate);
    return () => window.removeEventListener("motoguard:alerts", onUpdate);
  }, []);

  // Combinar alertas locais (tempo real) com histórico do backend
  const allAlerts = useMemo(() => {
    const localIds = new Set(alerts.map((a) => a.id));
    const merged = [
      ...alerts,
      ...backendAlerts.filter((a) => !localIds.has(a.id)),
    ];
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alerts, backendAlerts]);

  const devices = useMemo(() => {
    const set = new Set<string>();
    allAlerts.forEach((a) => { if (a.deviceId) set.add(a.deviceId); });
    return Array.from(set).sort();
  }, [allAlerts]);

  const types = useMemo(() => {
    const set = new Set<AlertType>();
    allAlerts.forEach((a) => { if (a.type) set.add(a.type); });
    return Array.from(set).sort();
  }, [allAlerts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return allAlerts
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
    return allAlerts.find((a) => a.id === selectedId) ?? null;
  }, [allAlerts, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const settings = loadSettings();
    if (!settings.alerts.autoAckOnOpen) return;
    const current = allAlerts.find((a) => a.id === selectedId);
    if (!current || current.status !== "unread") return;
    const out = alerts.map<AlertItem>((a) =>
      a.id === selectedId ? { ...a, status: "ack" as AlertStatus } : a,
    );
    setAlerts(out);
    saveAlerts(out);
  }, [allAlerts, alerts, selectedId]);

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
        <div className="header-main">
          <div className="page-title">
            <span className="title-icon">🔔</span>
            Alertas & Eventos
          </div>
          <div className="page-subtitle">
            {allAlerts.filter((a) => a.status === "unread").length} por ler
            &nbsp;·&nbsp; {filtered.length} filtrados
            &nbsp;·&nbsp; {allAlerts.length} total
            {backendLoading && <span style={{ color: "var(--accent)", fontSize: "0.78rem" }}>· a carregar...</span>}
            {backendError && <span style={{ color: "var(--red)", fontSize: "0.78rem" }}>· {backendError}</span>}
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadBackendAlerts}
            disabled={backendLoading}
            title="Recarregar histórico do servidor"
          >
            <RefreshCw size={14} className={backendLoading ? "spin" : ""} />
            Atualizar
          </button>
          {allAlerts.filter((a) => a.status === "unread").length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { markAllRead(); setAlerts(loadAlerts()); }}
            >
              Marcar todas lidas
            </button>
          )}
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
                <div role="list" aria-label="Lista de alertas" aria-live="polite" className="alert-list">
                  {paginated.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="listitem"
                      aria-pressed={selectedId === a.id}
                      aria-label={`${a.title} — ${a.severity} — ${a.status === "unread" ? "Por ler" : "Reconhecido"}`}
                      onClick={() => setSelectedId(a.id)}
                      className={`alert-item ${selectedId === a.id ? "selected" : ""} ${a.status === "unread" ? "unread" : ""}`}
                    >
                      <div className="alert-item-left">
                        <div className="alert-item-header">
                          <span className="alert-item-title">{typeIcon(a.type)} {a.title}</span>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            {(a.meta as any)?.predictive && (
                              <span className="badge-pill" style={{ background: "var(--accent-light)", color: "var(--accent)", border: "1px solid var(--accent)30", fontSize: "0.68rem" }}>
                                📈 Preditivo
                              </span>
                            )}
                            <span className="badge-pill" style={{ color: severityColor(a.severity), background: "transparent", border: `1px solid ${severityColor(a.severity)}40` }}>
                              {a.severity}
                            </span>
                          </div>
                        </div>
                        <div className="alert-item-meta">
                          {formatDateTime(a.timestamp)}
                          {a.deviceId ? ` · ${a.deviceId}` : ""}
                          {a.type ? ` · ${ALERT_TYPE_LABELS[a.type]}` : ""}
                        </div>
                        <div className="alert-item-msg">{a.message}</div>
                        <div className="alert-item-footer">
                          <span className={`pill ${a.status === "unread" ? "pill-danger" : "pill-success"}`}>
                            {a.status === "unread" ? "Por ler" : "Reconhecido"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div role="navigation" aria-label="Paginação de alertas" className="pagination-row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Página anterior">
                      ‹ Anterior
                    </button>
                    <span className="page-info">{page} / {totalPages} · {filtered.length} alertas</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Próxima página">
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
              <div className="alert-detail">
                <div className="alert-detail-header">
                  <div>
                    <div className="alert-detail-title">{typeIcon(selected.type)} {selected.title}</div>
                    <div className="page-subtitle" style={{ margin: 0 }}>
                      {formatDateTime(selected.timestamp)}
                      {selected.motoModel ? ` · ${selected.motoModel}` : ""}
                      {selected.deviceId ? ` · ${selected.deviceId}` : ""}
                    </div>
                  </div>
                  <div className="alert-detail-badges">
                    <span className="badge-pill" style={{ color: severityColor(selected.severity), border: `1px solid ${severityColor(selected.severity)}40`, background: "transparent" }}>
                      {selected.severity}
                    </span>
                    {(selected.meta as any)?.predictive && (
                      <span className="badge-pill" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                        📈 Alerta Preditivo
                      </span>
                    )}
                    {selected.type && (
                      <span className="badge-pill" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
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
                  <div className="alert-detail-section-title">Mensagem</div>
                  <div style={{ color: "var(--text)" }}>{selected.message}</div>
                </div>

                {(selected.lat != null || selected.tripId) && (
                  <div className="alert-detail-actions">
                    {selected.lat != null && selected.lng != null && (
                      <a href={`https://maps.google.com/?q=${selected.lat},${selected.lng}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                        Ver no Google Maps
                      </a>
                    )}
                    {selected.lat != null && (
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/map`)}>Ver no mapa</button>
                    )}
                    {selected.tripId && (
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/trips/${selected.tripId}`)}>Ver viagem</button>
                    )}
                  </div>
                )}

                {selected.lat != null && selected.lng != null && (
                  <div className="subpanel">
                    <div className="alert-detail-section-title">Localização</div>
                    <div className="alert-coords">
                      <span>Lat: <strong>{selected.lat.toFixed(6)}</strong></span>
                      <span>Lng: <strong>{selected.lng.toFixed(6)}</strong></span>
                    </div>
                  </div>
                )}

                {selected.meta && (
                  <div className="subpanel">
                    <div className="alert-detail-section-title">Métricas no momento</div>
                    <pre className="alert-meta-pre">{JSON.stringify(selected.meta, null, 2)}</pre>
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
