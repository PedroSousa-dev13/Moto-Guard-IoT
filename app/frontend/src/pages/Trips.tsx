import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { tripsAPI, motorcyclesAPI } from "../services/api";
import { Trip, TripFeedItem, TripSource, TripStatus, Motorcycle } from "../types";
import { Link } from "react-router-dom";
import { applyTripFilters, paginate } from "../utils/trips";
import { imageFromCategory } from "../utils/categoryImageMap";
import {
  Route, Calendar, Bike, ChevronDown, AlertCircle, Clock,
  Zap, ArrowRight, ChevronLeft, ChevronRight, Database,
  Cpu, Monitor, Info, ChevronUp, History, Activity
} from "lucide-react";
import Card from "../components/ui/Card";
import { SkeletonRow, SkeletonCard } from "../components/ui/Skeleton";

type TripSourceFilter = "ALL" | TripSource;
type TripStatusFilter = "ALL" | TripStatus;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
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
    case "ACTIVE":    return { bg: "rgba(34,197,94,0.1)",  color: "#22c55e", label: "Ativa",     icon: <Zap size={12} /> };
    case "COMPLETED": return { bg: "rgba(59,130,246,0.1)", color: "#3b82f6", label: "Concluída", icon: <Calendar size={12} /> };
    case "CANCELLED": return { bg: "rgba(239,68,68,0.1)",  color: "#ef4444", label: "Cancelada", icon: <AlertCircle size={12} /> };
    default:          return { bg: "rgba(113,113,122,0.1)",color: "#71717a", label: status,      icon: <Info size={12} /> };
  }
}

function sourceBadge(source: TripSource) {
  switch (source) {
    case "SIMULATOR":    return { bg: "rgba(14,165,233,0.1)",  color: "#0ea5e9", label: "Simulador", icon: <Monitor size={12} /> };
    case "GPX_IMPORTED": return { bg: "rgba(16,185,129,0.1)",  color: "#10b981", label: "GPX",       icon: <Database size={12} /> };
    case "DEVICE_REAL":  return { bg: "rgba(244,114,182,0.1)", color: "#f472b6", label: "Real",      icon: <Cpu size={12} /> };
    default:             return { bg: "rgba(113,113,122,0.1)", color: "#71717a", label: source,      icon: <Route size={12} /> };
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case "CRITICAL": return "var(--red)";
    case "WARNING":  return "var(--yellow)";
    default:         return "var(--muted)";
  }
}

function eventTypeIcon(type: string) {
  const icons: Record<string, string> = {
    CRASH_DETECTED: "💥", EXCESSIVE_LEAN: "↗️", HARD_BRAKING: "🛑",
    OVERHEAT: "🌡️", LOW_VOLTAGE: "🔋", HIGH_VIBRATION: "📳",
    RAPID_ACCELERATION: "🚀", TIRE_PRESSURE_LOW: "🛞", OIL_PRESSURE_LOW: "🛢️",
    SPEEDING: "🚨",
  };
  return icons[type] ?? "⚠️";
}

function scoreStyle(score: number) {
  if (score >= 80) return { bg: "rgba(34,197,94,0.12)",  color: "#22c55e" };
  if (score >= 60) return { bg: "rgba(202,138,4,0.14)",  color: "#ca8a04" };
  return              { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" };
}

// ─── Moto Card ────────────────────────────────────────────────────────────────

function MotoCard({ moto, selected, tripCount, onClick }: {
  moto: Motorcycle; selected: boolean; tripCount: number; onClick: () => void;
}) {
  const img = imageFromCategory(moto.category);
  return (
    <button type="button" onClick={onClick} className={`moto-filter-card ${selected ? "selected" : ""}`}>
      <div className="moto-filter-img">
        <img src={img} alt={moto.category ?? moto.name}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>
      <div className="moto-filter-body">
        <div className="moto-filter-name">{moto.name}</div>
        {moto.category && <div className="moto-filter-cat">{moto.category}</div>}
        <div className="moto-filter-sub">{[moto.brand, moto.model, moto.year].filter(Boolean).join(" · ") || "—"}</div>
        <div className="moto-filter-count">{tripCount} viagem{tripCount !== 1 ? "s" : ""}</div>
      </div>
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [feed, setFeed] = useState<TripFeedItem[]>([]);
  const [motos, setMotos] = useState<Motorcycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [motosLoading, setMotosLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [view, setView] = useState<"FEED" | "LIST">("FEED");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<TripSourceFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>("ALL");
  const [selectedMotoId, setSelectedMotoId] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [onlyWithEvents, setOnlyWithEvents] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "Viagens — MotoGuard";
    void loadMotos();
    void refresh();
  }, []);

  useEffect(() => {
    const socket = io();
    socket.on("trip_started", () => void refresh());
    socket.on("trip_ended", () => void refresh());
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => { void refresh(); setExpandedId(null); setPage(1); }, [view, sourceFilter]);

  async function loadMotos() {
    try {
      const res = await motorcyclesAPI.getAll();
      setMotos(res.data);
    } catch { /* silently fail */ }
    finally { setMotosLoading(false); }
  }

  async function loadTrips() {
    try {
      setIsLoading(true); setError(null);
      const res = await tripsAPI.getAll(sourceFilter === "ALL" ? undefined : sourceFilter);
      setTrips(res.data);
    } catch { setError("Não foi possível carregar as viagens."); }
    finally { setIsLoading(false); }
  }

  async function loadFeed() {
    try {
      setFeedLoading(true); setFeedError(null);
      const res = await tripsAPI.getFeed(sourceFilter === "ALL" ? undefined : sourceFilter, 200);
      setFeed(res.data);
    } catch { setFeedError("Não foi possível carregar o feed."); }
    finally { setFeedLoading(false); }
  }

  async function refresh() {
    if (view === "FEED") return loadFeed();
    return loadTrips();
  }

  async function ensureDetails(tripId: string) {
    if (trips.find((t) => t.id === tripId)?.events) return;
    try {
      setDetailLoadingId(tripId);
      const res = await tripsAPI.getById(tripId);
      setTrips((prev) => prev.map((t) => t.id === tripId ? { ...t, ...res.data } : t));
    } finally { setDetailLoadingId((p) => p === tripId ? null : p); }
  }

  // ── Filtering ────────────────────────────────────────────────────────────
  const filteredTrips = applyTripFilters(trips, {
    status: statusFilter,
    motorcycleId: selectedMotoId,
    fromDate, toDate, onlyWithEvents,
  });

  const filteredFeed = feed.filter((t) => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (selectedMotoId !== "ALL" && t.motorcycle?.id !== selectedMotoId) return false;
    if (fromDate && new Date(t.startedAt) < new Date(fromDate)) return false;
    if (toDate) { const to = new Date(toDate); to.setHours(23,59,59,999); if (new Date(t.startedAt) > to) return false; }
    if (onlyWithEvents && (t.eventCounts?.total ?? 0) === 0) return false;
    return true;
  });

  // Trip count per moto (from feed + trips combined)
  function tripCountForMoto(motoId: string) {
    const fromFeed = feed.filter((t) => t.motorcycle?.id === motoId).length;
    const fromList = trips.filter((t) => t.motorcycleId === motoId).length;
    return Math.max(fromFeed, fromList);
  }

  const activeLoading = view === "FEED" ? feedLoading : isLoading;
  const activeError   = view === "FEED" ? feedError   : error;
  const activeCount   = view === "FEED" ? filteredFeed.length : filteredTrips.length;

  const listPagination = paginate(filteredTrips, page, pageSize);
  const feedPagination = paginate(filteredFeed,  page, pageSize);
  const safePage   = view === "FEED" ? feedPagination.page       : listPagination.page;
  const totalPages = view === "FEED" ? feedPagination.totalPages : listPagination.totalPages;
  const pagedFeed  = feedPagination.items;
  const pagedTrips = listPagination.items;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (activeLoading && motosLoading) {
    return (
      <div className="page">
        <div className="page-header"><div className="page-title">🗺️ Histórico de Viagens</div></div>
        <div className="card" style={{ padding: 16 }}>
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Erro ao carregar viagens</div>
          <div className="empty-state-text">{activeError}</div>
          <button className="btn btn-primary" onClick={() => void refresh()}>Tentar novamente</button>
        </div>
      </div>
    );
  }

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
          <button className={`btn btn-sm ${view === "FEED" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setView("FEED"); setExpandedId(null); setPage(1); }}>
            <Activity size={14} /> Feed
          </button>
          <button className={`btn btn-sm ${view === "LIST" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setView("LIST"); setExpandedId(null); setPage(1); }}>
            <History size={14} /> Lista
          </button>
        </div>
      </div>

      {motos.length > 0 && (
        <div className="moto-filter-section">
          <div className="section-label" style={{ marginBottom: 10 }}>Filtrar por mota</div>
          <div className="moto-filter-scroll">
            <button type="button" onClick={() => { setSelectedMotoId("ALL"); setPage(1); setExpandedId(null); }}
              className={`moto-filter-card moto-filter-all ${selectedMotoId === "ALL" ? "selected" : ""}`}>
              <div className="moto-filter-img moto-filter-img-all">
                <Bike size={28} style={{ color: selectedMotoId === "ALL" ? "var(--accent)" : "var(--muted)" }} />
              </div>
              <div className="moto-filter-body">
                <div className="moto-filter-name">Todas</div>
                <div className="moto-filter-count">{view === "FEED" ? feed.length : trips.length} viagens</div>
              </div>
            </button>
            {motos.map((moto) => (
              <MotoCard key={moto.id} moto={moto} selected={selectedMotoId === moto.id}
                tripCount={tripCountForMoto(moto.id)}
                onClick={() => { setSelectedMotoId(moto.id); setPage(1); setExpandedId(null); }} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card title="Filtros" className="filter-card">
        <div className="filter-grid">
          <div className="field">
            <label className="field-label">Origem</label>
            <select className="control" value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as TripSourceFilter)}>
              <option value="ALL">Todas</option>
              <option value="SIMULATOR">Simulador</option>
              <option value="GPX_IMPORTED">GPX</option>
              <option value="DEVICE_REAL">Dispositivo</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Estado</label>
            <select className="control" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TripStatusFilter); setPage(1); setExpandedId(null); }}>
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Ativas</option>
              <option value="COMPLETED">Concluídas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">De</label>
            <input className="control" type="date" value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); setExpandedId(null); }} />
          </div>
          <div className="field">
            <label className="field-label">Até</label>
            <input className="control" type="date" value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); setExpandedId(null); }} />
          </div>
          <div className="field" style={{ justifyContent: "center" }}>
            <label className="auth-checkbox">
              <input type="checkbox" checked={onlyWithEvents}
                onChange={(e) => { setOnlyWithEvents(e.target.checked); setPage(1); setExpandedId(null); }} />
              <span>Só com eventos</span>
            </label>
          </div>
        </div>
      </Card>

      {activeCount === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🛣️</div>
          <div className="empty-state-title">Sem viagens</div>
          <div className="empty-state-text">
            {selectedMotoId !== "ALL"
              ? "Esta mota ainda não tem viagens registadas."
              : "As viagens são criadas automaticamente quando a simulação termina."}
          </div>
        </div>
      )}

      <div className="trip-list">
        {view === "FEED" ? (
          <div className="trip-grid">
            {pagedFeed.map((item) => <TripFeedCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="trip-grid">
            {pagedTrips.map((trip) => (
              <TripListCard
                key={trip.id}
                trip={trip}
                expandedId={expandedId}
                detailLoadingId={detailLoadingId}
                onToggle={async (id) => {
                  setExpandedId((p) => p === id ? null : id);
                  if (expandedId !== id) await ensureDetails(id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {activeCount > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="field-label">Por página</span>
            <select className="control control-sm" value={pageSize} style={{ width: 120 }}
              onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); setExpandedId(null); }}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn btn-ghost btn-sm" disabled={safePage <= 1}
              onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpandedId(null); }}>
              <ChevronLeft size={16} /> Anterior
            </button>
            <span className="page-info">Página {safePage} de {totalPages}</span>
            <button className="btn btn-ghost btn-sm" disabled={safePage >= totalPages}
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setExpandedId(null); }}>
              Seguinte <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function TripFeedCard({ item }: { item: TripFeedItem }) {
  const badge = statusBadge(item.status);
  const src   = sourceBadge(item.source);
  const safety = scoreStyle(item.safetyScore);
  const perf   = scoreStyle(item.performanceScore);
  const motoImg = imageFromCategory(item.motorcycle?.category);

  return (
    <div className="trip-card-v2" style={{ display: "flex", overflow: "hidden" }}>
      {/* Moto image strip — lateral, imagem rodada 90° */}
      <div style={{ width: 80, minWidth: 80, flexShrink: 0, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img
          src={motoImg}
          alt={item.motorcycle?.category ?? "moto"}
          style={{ width: 140, height: 80, objectFit: "cover", transform: "rotate(270deg)" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
      <div className="trip-summary" style={{ cursor: "default" }}>
        <div className="trip-info-main">
          <div className="trip-mota-line">
            <Bike size={18} className="mota-icon-v2" />
            <span className="mota-name-v2">
              {item.motorcycle?.name ?? "—"}
              {item.motorcycle?.brand ? ` (${item.motorcycle.brand})` : ""}
            </span>
            <div className="trip-badges-v2">
              <span className="badge-v2" style={{ background: badge.bg, color: badge.color }}>{badge.icon}{badge.label}</span>
              <span className="badge-v2" style={{ background: src.bg, color: src.color }}>{src.icon}{src.label}</span>
            </div>
          </div>
          <div className="trip-meta-line">
            <Calendar size={14} /><span>{formatDate(item.startedAt)}</span>
            <span className="separator">•</span>
            <Clock size={14} /><span>{formatDuration(item.startedAt, item.endedAt ?? undefined)}</span>
            <span className="separator">•</span>
            <AlertCircle size={14} /><span>{item.eventCounts?.total ?? 0} eventos</span>
          </div>
        </div>
        <div className="trip-stats-quick" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="badge-v2" style={{ background: safety.bg, color: safety.color }}>Safety {item.safetyScore}</span>
          <span className="badge-v2" style={{ background: perf.bg, color: perf.color }}>Perf {item.performanceScore}</span>
        </div>
      </div>
      <div style={{ padding: "0 20px 16px" }}>
        {item.labels?.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {item.labels.map((l) => (
              <span key={l} className="badge-v2" style={{ background: "rgba(79,70,229,0.10)", color: "var(--accent)" }}>{l}</span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="trip-stats-quick">
            <div className="quick-stat"><span className="stat-v">{item.distanceKm?.toFixed(1) ?? "—"}</span><span className="stat-u">km</span></div>
            <div className="quick-stat"><span className="stat-v">{item.avgSpeedKmh?.toFixed(0) ?? "—"}</span><span className="stat-u">km/h</span></div>
            <div className="quick-stat"><span className="stat-v">{item.maxSpeedKmh?.toFixed(0) ?? "—"}</span><span className="stat-u">max</span></div>
          </div>
          <Link to={`/trips/${item.id}`} className="btn btn-primary btn-sm">
            Abrir análise <ArrowRight size={16} />
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── List Card ────────────────────────────────────────────────────────────────

function TripListCard({
  trip, expandedId, detailLoadingId, onToggle,
}: {
  trip: Trip;
  expandedId: string | null;
  detailLoadingId: string | null;
  onToggle: (id: string) => void | Promise<void>;
}) {
  const badge = statusBadge(trip.status);
  const src   = sourceBadge(trip.source);
  const isOpen = expandedId === trip.id;
  const evCount = trip.events?.length ?? trip._count?.events ?? 0;
  const isDetailLoading = detailLoadingId === trip.id;
  const motoImg = imageFromCategory((trip.motorcycle as any)?.category);

  return (
    <div className={`trip-card-v2 ${isOpen ? "open" : ""}`} style={{ display: "flex", overflow: "hidden" }}>
      {/* Moto image strip — lateral, imagem rodada 90° */}
      <div style={{ width: 80, minWidth: 80, flexShrink: 0, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <img
          src={motoImg}
          alt="moto"
          style={{ width: 140, height: 80, objectFit: "cover", transform: "rotate(270deg)" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <button type="button" onClick={() => onToggle(trip.id)} className="trip-summary">
          <div className="trip-info-main">
            <div className="trip-mota-line">
              <Bike size={18} className="mota-icon-v2" />
              <span className="mota-name-v2">
                {trip.motorcycle?.name ?? "—"}
                {trip.motorcycle?.brand ? ` (${trip.motorcycle.brand})` : ""}
              </span>
              <div className="trip-badges-v2">
                <span className="badge-v2" style={{ background: badge.bg, color: badge.color }}>{badge.icon}{badge.label}</span>
                <span className="badge-v2" style={{ background: src.bg, color: src.color }}>{src.icon}{src.label}</span>
              </div>
            </div>
            <div className="trip-meta-line">
              <Calendar size={14} /><span>{formatDate(trip.startedAt)}</span>
              <span className="separator">•</span>
              <Clock size={14} /><span>{formatDuration(trip.startedAt, trip.endedAt)}</span>
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
                <AlertCircle size={14} /><span className="stat-v">{evCount}</span>
              </div>
            )}
            <div className="expand-icon">{isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
          </div>
        </button>

        {isOpen && (
          <div className="trip-expanded-content">
            {isDetailLoading ? (
              <div className="detail-loading"><div className="spinner-small"></div><span>A carregar detalhes...</span></div>
            ) : (
              <>
                <div className="expanded-stats-grid">
                  <div className="stat-tile">
                    <span className="tile-label">Vel. Máxima</span>
                    <span className="tile-value">{trip.maxSpeedKmh?.toFixed(1) ?? "—"} <small>km/h</small></span>
                  </div>
                  <div className="stat-tile">
                    <span className="tile-label">Vel. Média</span>
                    <span className="tile-value">{trip.avgSpeedKmh?.toFixed(1) ?? "—"} <small>km/h</small></span>
                  </div>
                  <div className="stat-tile">
                    <span className="tile-label">Inclinação Máx.</span>
                    <span className="tile-value">{trip.maxRollDeg?.toFixed(1) ?? "—"} <small>°</small></span>
                  </div>
                  <div className="stat-tile">
                    <span className="tile-label">Força G Máx.</span>
                    <span className="tile-value">{trip.maxGForce?.toFixed(2) ?? "—"} <small>G</small></span>
                  </div>
                </div>
                <div className="expanded-actions">
                  <Link to={`/trips/${trip.id}`} className="btn btn-primary btn-sm">
                    <Activity size={14} /> Análise Detalhada <ArrowRight size={14} />
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
                              <div className="event-meta-v2"><Zap size={10} />{ev.speedKmh.toFixed(0)} km/h</div>
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
    </div>
  );
}
