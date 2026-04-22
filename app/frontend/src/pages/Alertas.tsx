import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { 
  RefreshCw, 
  Search, 
  CheckCircle, 
  Filter, 
  X, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Activity, 
  Info, 
  AlertTriangle, 
  AlertCircle,
  ExternalLink,
  History,
  LayoutList
} from "lucide-react";
import "./Alertas.css";

type StatusFilter = "all" | "unread" | "ack";
type SeverityFilter = "all" | "INFO" | "WARNING" | "CRITICAL";
type TypeFilter = "all" | AlertType;
type ViewMode = "list" | "timeline";

const PAGE_SIZE = 15;

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  switch (severity) {
    case "CRITICAL": return <AlertCircle size={18} color="var(--red)" />;
    case "WARNING": return <AlertTriangle size={18} color="var(--yellow)" />;
    default: return <Info size={18} color="var(--muted)" />;
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
      setBackendError("Erro ao carregar histórico.");
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

  useEffect(() => {
    const onUpdate = () => setAlerts(loadAlerts());
    window.addEventListener("motoguard:alerts", onUpdate);
    return () => window.removeEventListener("motoguard:alerts", onUpdate);
  }, []);

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
  }, [allAlerts, query, severity, status, type, deviceFilter, dateFrom, dateTo]);

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
            <span style={{ color: "var(--accent)" }}>{allAlerts.filter((a) => a.status === "unread").length} por ler</span>
            &nbsp;·&nbsp; {filtered.length} filtrados
            &nbsp;·&nbsp; {allAlerts.length} total
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-ghost btn-sm"
            onClick={loadBackendAlerts}
            disabled={backendLoading}
          >
            <RefreshCw size={14} className={backendLoading ? "spin" : ""} />
            Atualizar
          </button>
          {allAlerts.filter((a) => a.status === "unread").length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { markAllRead(); setAlerts(loadAlerts()); }}
            >
              <CheckCircle size={14} />
              Marcar lidas
            </button>
          )}
          <div className="status-group">
            <button
              className={`btn btn-sm ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setViewMode("list")}
            >
              <LayoutList size={14} />
              Lista
            </button>
            <button
              className={`btn btn-sm ${viewMode === "timeline" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setViewMode("timeline")}
            >
              <History size={14} />
              Timeline
            </button>
          </div>
        </div>
      </div>

      <div className="alerts-container">
        {/* Filter Bar */}
        <div className="alerts-filter-bar">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              className="control"
              placeholder="Pesquisar mensagens, dispositivos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          
          <div className="filter-group">
            <select
              className="control control-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              style={{ width: 130 }}
            >
              <option value="all">Estado: Todos</option>
              <option value="unread">Por ler</option>
              <option value="ack">Reconhecidos</option>
            </select>
            
            <select
              className="control control-sm"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityFilter)}
              style={{ width: 130 }}
            >
              <option value="all">Severidade</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
            </select>

            <select
              className="control control-sm"
              value={type}
              onChange={(e) => setType(e.target.value as TypeFilter)}
              style={{ width: 140 }}
            >
              <option value="all">Tipo de Evento</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {ALERT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            {devices.length > 1 && (
              <select
                className="control control-sm"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                style={{ width: 150 }}
              >
                <option value="all">Todos Dispositivos</option>
                {devices.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}

            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <X size={14} />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="alerts-main-layout">
          {/* List Pane */}
          <div className="alerts-list-pane custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="empty-pane">
                <div className="empty-icon-v3">📭</div>
                <div className="empty-text-v3">
                  <h3>Sem alertas encontrados</h3>
                  <p>Tenta ajustar os filtros para encontrar o que procuras.</p>
                </div>
              </div>
            ) : viewMode === "list" ? (
              paginated.map((a) => (
                <button
                  key={a.id}
                  className={`alert-card-v3 ${selectedId === a.id ? "selected" : ""} ${a.status === "unread" ? "unread" : ""}`}
                  onClick={() => setSelectedId(a.id)}
                >
                  <div className="alert-v3-header">
                    <div className="alert-v3-title-row">
                      <span className="alert-v3-icon">{typeIcon(a.type)}</span>
                      <span className="alert-v3-title">{a.title}</span>
                    </div>
                    <span className="alert-v3-time">{formatDateTime(a.timestamp)}</span>
                  </div>
                  <div className="alert-v3-message">{a.message}</div>
                  <div className="alert-v3-footer">
                    <span className="alert-v3-device">{a.motoModel || a.deviceId || "Sistema"}</span>
                    <SeverityIcon severity={a.severity} />
                  </div>
                </button>
              ))
            ) : (
              /* Timeline View */
              <div className="timeline-v3">
                {paginated.map((a) => (
                  <div key={a.id} className="timeline-item-v3">
                    <div 
                      className="timeline-dot-v3" 
                      style={{ background: severityDotColor(a.severity) }}
                    />
                    <div 
                      className={`timeline-card-v3 ${selectedId === a.id ? "selected" : ""}`}
                      onClick={() => setSelectedId(a.id)}
                    >
                      <div className="alert-v3-header">
                        <div className="alert-v3-title-row">
                          <span className="alert-v3-title">{typeIcon(a.type)} {a.title}</span>
                        </div>
                        <span className="alert-v3-time">{formatDateTime(a.timestamp)}</span>
                      </div>
                      <div className="alert-v3-message" style={{ marginTop: 4 }}>{a.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="pagination-v3">
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setPage((p) => Math.max(1, p - 1))} 
                  disabled={page === 1}
                >
                  Anterior
                </button>
                <span className="page-info">{page} / {totalPages}</span>
                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                  disabled={page === totalPages}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

          {/* Detail Pane */}
          <div className="alerts-detail-pane">
            {!selected ? (
              <div className="empty-pane">
                <div className="empty-icon-v3">🧾</div>
                <div className="empty-text-v3">
                  <h3>Seleciona um alerta</h3>
                  <p>Escolhe um item na lista para ver todos os detalhes e métricas.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="detail-header">
                  <div className="detail-header-top">
                    <div className="detail-main-info">
                      <h2>
                        {typeIcon(selected.type)} 
                        {selected.title}
                      </h2>
                      <div className="page-subtitle">
                        <Clock size={14} /> {formatDateTime(selected.timestamp)}
                        {selected.motoModel && <> &nbsp;·&nbsp; {selected.motoModel}</>}
                      </div>
                    </div>
                    <div className="detail-actions">
                      <button
                        className={`btn btn-sm ${selected.status === "unread" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setAlert({ ...selected, status: selected.status === "unread" ? "ack" : "unread" })}
                      >
                        {selected.status === "unread" ? <CheckCircle size={14} /> : <Search size={14} />}
                        {selected.status === "unread" ? "Reconhecer" : "Marcar não lido"}
                      </button>
                    </div>
                  </div>

                  <div className="detail-badges">
                    <span className="badge-pill" style={{ 
                      color: severityColor(selected.severity), 
                      border: `1px solid ${severityColor(selected.severity)}40`, 
                      background: `${severityColor(selected.severity)}10` 
                    }}>
                      <SeverityIcon severity={selected.severity} />
                      {selected.severity}
                    </span>
                    {selected.type && (
                      <span className="badge-pill" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
                        <Activity size={14} />
                        {ALERT_TYPE_LABELS[selected.type]}
                      </span>
                    )}
                    {selected.deviceId && (
                      <span className="badge-pill" style={{ background: "var(--surface-3)", color: "var(--muted)" }}>
                        ID: {selected.deviceId}
                      </span>
                    )}
                  </div>
                </div>

                <div className="detail-content custom-scrollbar">
                  <div className="detail-section">
                    <div className="detail-section-title">Mensagem</div>
                    <div className="detail-message-box">
                      {selected.message}
                    </div>
                  </div>

                  {selected.meta && Object.keys(selected.meta).length > 0 && (
                    <div className="detail-section">
                      <div className="detail-section-title">Métricas no Momento</div>
                      <div className="metrics-grid-v3">
                        {Object.entries(selected.meta).map(([key, value]) => {
                          if (value == null) return null;
                          return (
                            <div key={key} className="metric-item-v3">
                              <span className="metric-label">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="metric-value">
                                {typeof value === 'number' ? value.toFixed(key.toLowerCase().includes('temp') ? 1 : 2) : String(value)}
                                {key.toLowerCase().includes('kmh') && " km/h"}
                                {key.toLowerCase().includes('temp') && " °C"}
                                {key.toLowerCase().includes('voltage') && " V"}
                                {key.toLowerCase().includes('deg') && "°"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(selected.lat != null || selected.tripId) && (
                    <div className="detail-section">
                      <div className="detail-section-title">Ações Rápidas</div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {selected.lat != null && selected.lng != null && (
                          <a 
                            href={`https://maps.google.com/?q=${selected.lat},${selected.lng}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-sm btn-ghost"
                          >
                            <ExternalLink size={14} />
                            Google Maps
                          </a>
                        )}
                        {selected.lat != null && (
                          <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/map`)}>
                            <MapPin size={14} />
                            Ver no Mapa
                          </button>
                        )}
                        {selected.tripId && (
                          <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/trips/${selected.tripId}`)}>
                            <ChevronRight size={14} />
                            Ver Viagem
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selected.lat != null && selected.lng != null && (
                    <div className="detail-section">
                      <div className="detail-section-title">Coordenadas</div>
                      <div className="subpanel" style={{ display: "flex", gap: 20 }}>
                        <div><span style={{ color: "var(--muted)" }}>Latitude:</span> <strong>{selected.lat.toFixed(6)}</strong></div>
                        <div><span style={{ color: "var(--muted)" }}>Longitude:</span> <strong>{selected.lng.toFixed(6)}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
