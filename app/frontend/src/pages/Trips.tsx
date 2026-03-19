import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { tripsAPI } from "../services/api";
import { Trip, TripFeedItem, TripSource, TripStatus } from "../types";
import { Link } from "react-router-dom";
import { applyTripFilters, groupTripsBySource, listMotorcyclesForFilter, paginate } from "../utils/trips";
import { 
  Route, 
  Calendar, 
  Bike, 
  ChevronDown, 
  AlertCircle, 
  Filter, 
  Clock, 
  MapPin, 
  Zap, 
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Database,
  Cpu,
  Monitor,
  Info,
  ChevronUp,
  History,
  Activity
} from 'lucide-react';
import Card from "../components/ui/Card";
import { SkeletonRow } from "../components/ui/Skeleton";

type TripSourceFilter = "ALL" | TripSource;
type TripStatusFilter = "ALL" | TripStatus;
type TripHistoryView = "FEED" | "LIST";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end?: string) {
  if (!end) return "A decorrer";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${totalMins}m`;
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return { bg: "rgba(34,197,94,0.1)", color: "#22c55e", label: "Ativa", icon: <Zap size={12} /> };
    case "COMPLETED":
      return {
        bg: "rgba(59,130,246,0.1)",
        color: "#3b82f6",
        label: "Concluída",
        icon: <Calendar size={12} />
      };
    case "CANCELLED":
      return {
        bg: "rgba(239,68,68,0.1)",
        color: "#ef4444",
        label: "Cancelada",
        icon: <AlertCircle size={12} />
      };
    default:
      return { bg: "rgba(113,113,122,0.1)", color: "#71717a", label: status, icon: <Info size={12} /> };
  }
}

function sourceBadge(source: TripSource) {
  switch (source) {
    case "SIMULATOR":
      return { bg: "rgba(14,165,233,0.1)", color: "#0ea5e9", label: "Simulador", icon: <Monitor size={12} /> };
    case "GPX_IMPORTED":
      return { bg: "rgba(16,185,129,0.1)", color: "#10b981", label: "GPX", icon: <Database size={12} /> };
    case "DEVICE_REAL":
      return { bg: "rgba(244,114,182,0.1)", color: "#f472b6", label: "Real", icon: <Cpu size={12} /> };
    default:
      return { bg: "rgba(113,113,122,0.1)", color: "#71717a", label: source, icon: <Route size={12} /> };
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "var(--red)";
    case "WARNING":
      return "var(--yellow)";
    default:
      return "var(--muted)";
  }
}

function eventTypeIcon(type: string) {
  // Mantemos emojis para tipos específicos mas podemos usar Lucide para outros
  const icons: Record<string, string> = {
    CRASH_DETECTED: "💥",
    EXCESSIVE_LEAN: "↗️",
    HARD_BRAKING: "🛑",
    OVERHEAT: "🌡️",
    LOW_VOLTAGE: "🔋",
    HIGH_VIBRATION: "📳",
    RAPID_ACCELERATION: "🚀",
    TIRE_PRESSURE_LOW: "🛞",
    OIL_PRESSURE_LOW: "🛢️",
  };
  return icons[type] ?? "⚠️";
}

function scoreStyle(score: number) {
  if (score >= 80) return { bg: "rgba(34,197,94,0.12)", color: "#22c55e" };
  if (score >= 60) return { bg: "rgba(202,138,4,0.14)", color: "#ca8a04" };
  return { bg: "rgba(239,68,68,0.12)", color: "#ef4444" };
}

// ...

// ─── Component ────────────────────────────────────────────────────────────────

export default function Trips() {
  const [view, setView] = useState<TripHistoryView>("FEED");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<TripFeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<TripSourceFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>("ALL");
  const [motorcycleFilter, setMotorcycleFilter] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [onlyWithEvents, setOnlyWithEvents] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void refresh();
  }, []);

  // Auto-refresh quando uma viagem começa ou termina
  useEffect(() => {
    const socket = io();
    socket.on("trip_started", () => void refresh());
    socket.on("trip_ended", () => void refresh());
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    void refresh();
  }, [view]);

  async function loadTrips() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await tripsAPI.getAll(sourceFilter === "ALL" ? undefined : sourceFilter);
      setTrips(res.data);
    } catch {
      setError(
        "Não foi possível carregar as viagens. Verifica a ligação ao servidor.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadFeed() {
    try {
      setFeedLoading(true);
      setFeedError(null);
      const res = await tripsAPI.getFeed(sourceFilter === "ALL" ? undefined : sourceFilter, 200);
      setFeed(res.data);
    } catch {
      setFeedError("Não foi possível carregar o feed. Verifica a ligação ao servidor.");
    } finally {
      setFeedLoading(false);
    }
  }

  async function refresh() {
    if (view === "FEED") return loadFeed();
    return loadTrips();
  }

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  useEffect(() => {
    void refresh();
    setExpandedId(null);
    setPage(1);
  }, [sourceFilter]);

  function applyFilters(list: Trip[]) {
    return applyTripFilters(list, {
      status: statusFilter,
      motorcycleId: motorcycleFilter,
      fromDate,
      toDate,
      onlyWithEvents,
    });
  }

  const filteredTrips = applyFilters(trips);
  const filteredFeed = (() => {
    let out = feed;

    if (statusFilter !== "ALL") {
      out = out.filter((t) => t.status === statusFilter);
    }

    if (motorcycleFilter !== "ALL") {
      out = out.filter((t) => t.motorcycle?.id === motorcycleFilter);
    }

    if (fromDate) {
      const from = new Date(fromDate);
      out = out.filter((t) => new Date(t.startedAt) >= from);
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      out = out.filter((t) => new Date(t.startedAt) <= to);
    }

    if (onlyWithEvents) {
      out = out.filter((t) => (t.eventCounts?.total ?? 0) > 0);
    }

    return out;
  })();

  const motorcyclesForFilter =
    view === "FEED"
      ? Array.from(
          new Map(
            feed
              .filter((t) => t.motorcycle?.id)
              .map((t) => [t.motorcycle!.id, t.motorcycle!]),
          ).values(),
        )
      : listMotorcyclesForFilter(trips);

  const listPagination = paginate(filteredTrips, page, pageSize);
  const feedPagination = paginate(filteredFeed, page, pageSize);

  const safePage = view === "FEED" ? feedPagination.page : listPagination.page;
  const totalPages = view === "FEED" ? feedPagination.totalPages : listPagination.totalPages;
  const pagedTrips = listPagination.items;
  const pagedFeed = feedPagination.items;
  const tripsBySource = groupTripsBySource(pagedTrips);

  async function ensureDetails(tripId: string) {
    const current = trips.find((t) => t.id === tripId);
    if (current?.events) return;
    try {
      setDetailLoadingId(tripId);
      const res = await tripsAPI.getById(tripId);
      setTrips((prev) => prev.map((t) => (t.id === tripId ? { ...t, ...res.data } : t)));
    } finally {
      setDetailLoadingId((prev) => (prev === tripId ? null : prev));
    }
  }

  const activeLoading = view === "FEED" ? feedLoading : isLoading;
  const activeError = view === "FEED" ? feedError : error;
  const activeCount = view === "FEED" ? filteredFeed.length : filteredTrips.length;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (activeLoading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">🗺️ Histórico de Viagens</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (activeError) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">{view === "FEED" ? "Erro ao carregar feed" : "Erro ao carregar viagens"}</div>
          <div className="empty-state-text" style={{ marginBottom: 14 }}>
            {activeError}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => void refresh()}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title">
            <History className="title-icon" size={24} />
            Histórico de Viagens
          </div>
          <div className="page-subtitle">
            <Route size={14} style={{ marginRight: 4 }} />
            {activeCount} viagem{activeCount !== 1 ? "s" : ""} registadas
          </div>
        </div>
        <div className="status-group">
          <button
            className={`btn btn-sm ${view === "FEED" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setView("FEED");
              setExpandedId(null);
              setPage(1);
            }}
          >
            <Activity size={14} />
            Feed
          </button>
          <button
            className={`btn btn-sm ${view === "LIST" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setView("LIST");
              setExpandedId(null);
              setPage(1);
            }}
          >
            <History size={14} />
            Lista
          </button>
        </div>
      </div>

      <Card title="Filtros de Pesquisa" className="filter-card">
        <div className="filter-grid">
          <div className="field">
            <label className="field-label">Origem</label>
            <select
              className="control"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as TripSourceFilter)}
            >
              <option value="ALL">Todas</option>
              <option value="SIMULATOR">Simulador</option>
              <option value="GPX_IMPORTED">GPX</option>
              <option value="DEVICE_REAL">Dispositivo</option>
            </select>
          </div>
          
          <div className="field">
            <label className="field-label">Estado</label>
            <select
              className="control"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as TripStatusFilter);
                setPage(1);
                setExpandedId(null);
              }}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativas</option>
              <option value="COMPLETED">Concluídas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>

          <div className="field">
            <label className="field-label">Mota</label>
            <select
              className="control"
              value={motorcycleFilter}
              onChange={(event) => {
                setMotorcycleFilter(event.target.value);
                setPage(1);
                setExpandedId(null);
              }}
            >
              <option value="ALL">Todas</option>
              {motorcyclesForFilter.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}{m.brand ? ` (${m.brand})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field-label">De</label>
            <input
              className="control"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
                setExpandedId(null);
              }}
            />
          </div>

          <div className="field">
            <label className="field-label">Até</label>
            <input
              className="control"
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
                setExpandedId(null);
              }}
            />
          </div>

          <div className="field" style={{ justifyContent: 'center' }}>
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={onlyWithEvents}
                onChange={(e) => {
                  setOnlyWithEvents(e.target.checked);
                  setPage(1);
                  setExpandedId(null);
                }}
              />
              <span>Só com eventos</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Empty state */}
      {activeCount === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🛣️</div>
          <div className="empty-state-title">{view === "FEED" ? "Ainda não há rides no feed" : "Ainda não há viagens registadas"}</div>
          <div className="empty-state-text">
            {sourceFilter === "ALL"
              ? "As viagens são criadas automaticamente quando a simulação termina (mesmo que seja curta)."
              : "Não há viagens para o filtro de origem selecionado."}
          </div>
        </div>
      )}

      {/* Trip list */}
      <div className="trip-list">
        {view === "FEED" ? (
          <div className="trip-grid">
            {pagedFeed.map((item) => (
              <TripFeedCard key={item.id} item={item} />
            ))}
          </div>
        ) : sourceFilter === "ALL" ? (
          <>
            <TripSection
              title="Simuladas"
              trips={tripsBySource.SIMULATOR}
              expandedId={expandedId}
              detailLoadingId={detailLoadingId}
              onToggle={async (id) => {
                toggle(id);
                if (expandedId !== id) await ensureDetails(id);
              }}
            />
            <TripSection
              title="GPX"
              trips={tripsBySource.GPX_IMPORTED}
              expandedId={expandedId}
              detailLoadingId={detailLoadingId}
              onToggle={async (id) => {
                toggle(id);
                if (expandedId !== id) await ensureDetails(id);
              }}
            />
            <TripSection
              title="Dispositivo"
              trips={tripsBySource.DEVICE_REAL}
              expandedId={expandedId}
              detailLoadingId={detailLoadingId}
              onToggle={async (id) => {
                toggle(id);
                if (expandedId !== id) await ensureDetails(id);
              }}
            />
          </>
        ) : (
          <TripSection
            title={sourceFilter === "SIMULATOR" ? "Simuladas" : sourceFilter === "GPX_IMPORTED" ? "GPX" : "Dispositivo"}
            trips={pagedTrips}
            expandedId={expandedId}
            detailLoadingId={detailLoadingId}
            onToggle={async (id) => {
              toggle(id);
              if (expandedId !== id) await ensureDetails(id);
            }}
          />
        )}
      </div>

      {activeCount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="field-label">Por página</span>
            <select
              className="control control-sm"
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setPage(1);
                setExpandedId(null);
              }}
              style={{ width: 120 }}
            >
              {[5, 10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="btn btn-ghost btn-sm"
              disabled={safePage <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setExpandedId(null);
              }}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>
            <span className="page-info">
              Página {safePage} de {totalPages}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              disabled={safePage >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                setExpandedId(null);
              }}
            >
              Seguinte
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TripFeedCard({ item }: { item: TripFeedItem }) {
  const badge = statusBadge(item.status);
  const tripSourceBadge = sourceBadge(item.source);
  const safety = scoreStyle(item.safetyScore);
  const performance = scoreStyle(item.performanceScore);

  return (
    <div className="trip-card-v2">
      <div className="trip-summary" style={{ cursor: "default" }}>
        <div className="trip-info-main">
          <div className="trip-mota-line">
            <Bike size={18} className="mota-icon-v2" />
            <span className="mota-name-v2">
              {item.motorcycle?.name ?? "—"}
              {item.motorcycle?.brand ? ` (${item.motorcycle.brand})` : ""}
            </span>
            <div className="trip-badges-v2">
              <span className="badge-v2" style={{ background: badge.bg, color: badge.color }}>
                {badge.icon}
                {badge.label}
              </span>
              <span className="badge-v2" style={{ background: tripSourceBadge.bg, color: tripSourceBadge.color }}>
                {tripSourceBadge.icon}
                {tripSourceBadge.label}
              </span>
            </div>
          </div>

          <div className="trip-meta-line">
            <Calendar size={14} />
            <span>{formatDate(item.startedAt)}</span>
            <span className="separator">•</span>
            <Clock size={14} />
            <span>{formatDuration(item.startedAt, item.endedAt ?? undefined)}</span>
            <span className="separator">•</span>
            <AlertCircle size={14} />
            <span>{item.eventCounts?.total ?? 0} eventos</span>
          </div>
        </div>

        <div className="trip-stats-quick" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="badge-v2" style={{ background: safety.bg, color: safety.color }}>
            Safety {item.safetyScore}
          </span>
          <span className="badge-v2" style={{ background: performance.bg, color: performance.color }}>
            Performance {item.performanceScore}
          </span>
        </div>
      </div>

      <div style={{ padding: "0 20px 16px" }}>
        {item.labels?.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {item.labels.map((label) => (
              <span
                key={label}
                className="badge-v2"
                style={{ background: "rgba(79,70,229,0.10)", color: "var(--accent)" }}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="trip-stats-quick">
            <div className="quick-stat">
              <span className="stat-v">{item.distanceKm?.toFixed(1) ?? "—"}</span>
              <span className="stat-u">km</span>
            </div>
            <div className="quick-stat">
              <span className="stat-v">{item.avgSpeedKmh?.toFixed(0) ?? "—"}</span>
              <span className="stat-u">km/h</span>
            </div>
            <div className="quick-stat">
              <span className="stat-v">{item.maxSpeedKmh?.toFixed(0) ?? "—"}</span>
              <span className="stat-u">max</span>
            </div>
          </div>

          <Link to={`/trips/${item.id}`} className="btn btn-primary btn-sm">
            Abrir análise
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function TripSection({
  title,
  trips,
  expandedId,
  detailLoadingId,
  onToggle,
}: {
  title: string;
  trips: Trip[];
  expandedId: string | null;
  detailLoadingId: string | null;
  onToggle: (id: string) => void | Promise<void>;
}) {
  if (trips.length === 0) return null;
  return (
    <div className="trip-section-container">
      <div className="section-header-row">
        <h3 className="section-title">{title}</h3>
        <span className="section-count">{trips.length} viagens</span>
      </div>

      <div className="trip-grid">
        {trips.map((trip) => {
          const badge = statusBadge(trip.status);
          const tripSourceBadge = sourceBadge(trip.source);
          const isOpen = expandedId === trip.id;
          const evCount = trip.events?.length ?? trip._count?.events ?? 0;
          const isDetailLoading = detailLoadingId === trip.id;

          return (
            <div
              key={trip.id}
              className={`trip-card-v2 ${isOpen ? "open" : ""}`}
            >
              <button
                type="button"
                onClick={() => onToggle(trip.id)}
                className="trip-summary"
              >
                <div className="trip-info-main">
                  <div className="trip-mota-line">
                    <Bike size={18} className="mota-icon-v2" />
                    <span className="mota-name-v2">
                      {trip.motorcycle?.name ?? "—"}
                      {trip.motorcycle?.brand ? ` (${trip.motorcycle.brand})` : ""}
                    </span>
                    <div className="trip-badges-v2">
                      <span className="badge-v2" style={{ background: badge.bg, color: badge.color }}>
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="badge-v2" style={{ background: tripSourceBadge.bg, color: tripSourceBadge.color }}>
                        {tripSourceBadge.icon}
                        {tripSourceBadge.label}
                      </span>
                    </div>
                  </div>
                  <div className="trip-meta-line">
                    <Calendar size={14} />
                    <span>{formatDate(trip.startedAt)}</span>
                    <span className="separator">•</span>
                    <Clock size={14} />
                    <span>{formatDuration(trip.startedAt, trip.endedAt)}</span>
                  </div>
                </div>

                <div className="trip-stats-quick">
                  {trip.distanceKm != null && (
                    <div className="quick-stat">
                      <span className="stat-v">{trip.distanceKm.toFixed(1)}</span>
                      <span className="stat-u">km</span>
                    </div>
                  )}
                  {evCount > 0 && (
                    <div className="quick-stat warning">
                      <AlertCircle size={14} />
                      <span className="stat-v">{evCount}</span>
                    </div>
                  )}
                  <div className="expand-icon">
                    {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="trip-expanded-content">
                  {isDetailLoading ? (
                    <div className="detail-loading">
                      <div className="spinner-small"></div>
                      <span>A carregar detalhes...</span>
                    </div>
                  ) : (
                    <>
                      <div className="expanded-stats-grid">
                        <div className="stat-tile">
                          <span className="tile-label">Velocidade Máxima</span>
                          <span className="tile-value">
                            {trip.status === "ACTIVE" && (trip.maxSpeedKmh === 0 || trip.maxSpeedKmh == null) 
                              ? "—" 
                              : trip.maxSpeedKmh?.toFixed(1)} <small>km/h</small>
                          </span>
                        </div>
                        <div className="stat-tile">
                          <span className="tile-label">Velocidade Média</span>
                          <span className="tile-value">
                            {trip.status === "ACTIVE" && (trip.avgSpeedKmh === 0 || trip.avgSpeedKmh == null) 
                              ? "—" 
                              : trip.avgSpeedKmh?.toFixed(1)} <small>km/h</small>
                          </span>
                        </div>
                        <div className="stat-tile">
                          <span className="tile-label">Inclinação Máxima</span>
                          <span className="tile-value">
                            {trip.status === "ACTIVE" && (trip.maxRollDeg === 0 || trip.maxRollDeg == null) 
                              ? "—" 
                              : trip.maxRollDeg?.toFixed(1)} <small>°</small>
                          </span>
                        </div>
                        <div className="stat-tile">
                          <span className="tile-label">Força G Máxima</span>
                          <span className="tile-value">
                            {trip.status === "ACTIVE" && (trip.maxGForce === 0 || trip.maxGForce == null) 
                              ? "—" 
                              : trip.maxGForce?.toFixed(2)} <small>G</small>
                          </span>
                        </div>
                      </div>

                      <div className="expanded-actions">
                        <Link to={`/trips/${trip.id}`} className="btn btn-primary btn-sm">
                          <Activity size={14} />
                          Análise Detalhada
                          <ArrowRight size={14} />
                        </Link>
                      </div>

                      {trip.events && trip.events.length > 0 && (
                        <div className="events-section-v2">
                          <div className="section-title-v2">Eventos de Risco</div>
                          <div className="events-list-v2">
                            {trip.events.map((ev) => (
                              <div key={ev.id} className="event-item-v2" style={{ borderLeftColor: severityColor(ev.severity) }}>
                                <span className="event-icon-v2">{eventTypeIcon(ev.type)}</span>
                                <div className="event-content-v2">
                                  <div className="event-top-v2">
                                    <span className="event-msg-v2">{ev.message}</span>
                                    <span className="event-time-v2">{new Date(ev.occurredAt).toLocaleTimeString("pt-PT")}</span>
                                  </div>
                                  {ev.speedKmh != null && (
                                    <div className="event-meta-v2">
                                      <Zap size={10} />
                                      {ev.speedKmh.toFixed(0)} km/h
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini stat component ──────────────────────────────────────────────────────
function Stat({
  value,
  label,
  color = "var(--text)",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-value" style={{ color }}>
        {value}
      </div>
      <div className="mini-stat-label">
        {label}
      </div>
    </div>
  );
}
