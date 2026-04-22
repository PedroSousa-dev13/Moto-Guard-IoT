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
import CompareBar from "../components/trips/CompareBar";
import ComparisonView from "../components/trips/ComparisonView";
import { ListStateSnapshot } from "../utils/tripComparison";
import TripCategoryBadge from "../components/trips/TripCategoryBadge";
import "./Trips.css";


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
    <div
      onClick={onClick}
      className={`premium-moto-card ${selected ? "selected" : ""}`}
    >
      <div className="moto-card-img">
        <img src={img} alt={moto.name} />
      </div>
      <div className="moto-card-info">
        <div className="moto-card-name">{moto.name}</div>
        <div className="moto-card-meta">
          {moto.brand} {moto.model}
        </div>
      </div>
      <div className="moto-card-stats">
        <span className="moto-trip-count">{tripCount} viagens</span>
      </div>
    </div>
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

  // ── Comparison state ─────────────────────────────────────────────────────
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [listStateSnapshot, setListStateSnapshot] = useState<ListStateSnapshot | null>(null);

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

  // ── Comparison handlers ──────────────────────────────────────────────────
  function handleCompareToggle(tripId: string) {
    setSelectedForComparison((prev) => {
      if (prev.includes(tripId)) return prev.filter((id) => id !== tripId);
      if (prev.length >= 2) return prev; // ignore if already 2 and this isn't one of them
      return [...prev, tripId];
    });
  }

  function handleOpenComparison() {
    setListStateSnapshot({
      page,
      pageSize,
      statusFilter,
      sourceFilter,
      selectedMotoId,
      fromDate,
      toDate,
      onlyWithEvents,
      expandedId,
    });
    setComparisonOpen(true);
  }

  function handleCloseComparison() {
    if (listStateSnapshot) {
      setPage(listStateSnapshot.page);
      setPageSize(listStateSnapshot.pageSize);
      setStatusFilter(listStateSnapshot.statusFilter);
      setSourceFilter(listStateSnapshot.sourceFilter);
      setSelectedMotoId(listStateSnapshot.selectedMotoId);
      setFromDate(listStateSnapshot.fromDate);
      setToDate(listStateSnapshot.toDate);
      setOnlyWithEvents(listStateSnapshot.onlyWithEvents);
      setExpandedId(listStateSnapshot.expandedId);
    }
    setComparisonOpen(false);
    setListStateSnapshot(null);
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

  // Summary stats for hero
  const totalKm = (view === "FEED" ? filteredFeed : filteredTrips).reduce((acc, t) => acc + (t.distanceKm ?? 0), 0);
  const avgSafety = (view === "FEED" ? filteredFeed : filteredTrips).reduce((acc, t) => acc + (t.safetyScore ?? 0), 0) / (activeCount || 1);


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
    <div className="page trips-container">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title">
            <History className="title-icon" size={28} />
            Histórico de Viagens
          </div>
          <div className="page-subtitle">
            <Route size={14} style={{ marginRight: 4 }} />
            Explore e analise o seu histórico de condução premium
          </div>
        </div>
        <div className="status-group">
          <button className={`btn ${view === "FEED" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setView("FEED"); setExpandedId(null); setPage(1); }}>
            <Activity size={18} /> Feed
          </button>
          <button className={`btn ${view === "LIST" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => { setView("LIST"); setExpandedId(null); setPage(1); }}>
            <History size={18} /> Lista
          </button>
        </div>
      </div>

      <div className="trips-hero">
        <div className="hero-stats">
          <div className="hero-stat-item">
            <span className="hero-stat-label">Total Viagens</span>
            <span className="hero-stat-value">{activeCount}</span>
          </div>
          <div className="hero-stat-item">
            <span className="hero-stat-label">Distância Total</span>
            <span className="hero-stat-value">{totalKm.toFixed(1)} <small style={{ fontSize: "0.5em", color: "var(--muted)" }}>KM</small></span>
          </div>
          <div className="hero-stat-item">
            <span className="hero-stat-label">Safety Score Médio</span>
            <span className="hero-stat-value" style={{ color: scoreStyle(avgSafety).color }}>{avgSafety.toFixed(0)}</span>
          </div>
        </div>
        <div className="hero-visual">
          {/* Subtle background decoration or icon */}
          <Activity size={64} style={{ opacity: 0.1, color: "var(--accent)" }} />
        </div>
      </div>

      {motos.length > 0 && (
        <div className="moto-selector-wrapper">
          <div className="section-label">Filtrar por Mota</div>
          <div className="moto-cards-scroll">
            <div
              onClick={() => { setSelectedMotoId("ALL"); setPage(1); setExpandedId(null); }}
              className={`premium-moto-card ${selectedMotoId === "ALL" ? "selected" : ""}`}
              style={{ minWidth: 160 }}
            >
              <div className="moto-card-img" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--accent-light)" }}>
                <Bike size={48} style={{ color: "var(--accent)" }} />
              </div>
              <div className="moto-card-info">
                <div className="moto-card-name">Todas</div>
                <div className="moto-card-meta">Ver histórico total</div>
              </div>
            </div>
            {motos.map((moto) => (
              <MotoCard key={moto.id} moto={moto} selected={selectedMotoId === moto.id}
                tripCount={tripCountForMoto(moto.id)}
                onClick={() => { setSelectedMotoId(moto.id); setPage(1); setExpandedId(null); }} />
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-premium-card">
        <div className="filters-header">
          <Zap size={18} style={{ color: "var(--accent)" }} />
          Filtros de Pesquisa
        </div>
        <div className="filters-grid-premium">
          <div className="field">
            <label className="field-label">Origem</label>
            <select className="premium-control" value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as TripSourceFilter)}>
              <option value="ALL">Todas as Origens</option>
              <option value="SIMULATOR">Simulador IoT</option>
              <option value="GPX_IMPORTED">Ficheiros GPX</option>
              <option value="DEVICE_REAL">Dispositivo Real</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">Estado</label>
            <select className="premium-control" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TripStatusFilter); setPage(1); setExpandedId(null); }}>
              <option value="ALL">Todos os Estados</option>
              <option value="ACTIVE">Ativas</option>
              <option value="COMPLETED">Concluídas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label">De</label>
            <input className="premium-control" type="date" value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); setExpandedId(null); }} />
          </div>
          <div className="field">
            <label className="field-label">Até</label>
            <input className="premium-control" type="date" value={toDate}
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
      </div>

      {activeCount === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🛣️</div>
          <div className="empty-state-title">Sem viagens encontradas</div>
          <div className="empty-state-text">
            {selectedMotoId !== "ALL"
              ? "Esta mota ainda não tem viagens que correspondam aos filtros."
              : "Inicie uma simulação ou importe um GPX para ver resultados aqui."}
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
                selectedForComparison={selectedForComparison}
                onCompareToggle={handleCompareToggle}
                onToggle={async (id) => {
                  setExpandedId((p) => p === id ? null : id);
                  if (expandedId !== id) await ensureDetails(id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {view === "LIST" && (
        <CompareBar
          selectedCount={selectedForComparison.length}
          onClear={() => setSelectedForComparison([])}
          onCompare={handleOpenComparison}
        />
      )}

      {activeCount > 0 && (
        <div className="pagination-premium">
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="field-label">Por página</span>
            <select className="premium-control" style={{ padding: "6px 12px", fontSize: "0.8rem", width: "80px" }}
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); setExpandedId(null); }}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="page-controls">
            <button className="page-btn" disabled={safePage <= 1}
              onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpandedId(null); }}>
              <ChevronLeft size={20} />
            </button>
            <span className="page-number-info">Página {safePage} de {totalPages}</span>
            <button className="page-btn" disabled={safePage >= totalPages}
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setExpandedId(null); }}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {comparisonOpen && selectedForComparison.length === 2 && (
        <ComparisonView
          tripIds={selectedForComparison as [string, string]}
          trips={trips}
          onClose={handleCloseComparison}
        />
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
    <div className="trip-card-premium">
      <div className="trip-card-image">
        <img src={motoImg} alt="moto" />
      </div>
      <div className="trip-card-main">
        <div className="trip-card-header">
          <div className="trip-card-title">{item.motorcycle?.name}</div>
          <div className="trip-card-badges">
            <span className="trip-premium-badge" style={{ background: badge.bg, color: badge.color }}>
              {badge.icon} {badge.label}
            </span>
            <span className="trip-premium-badge" style={{ background: src.bg, color: src.color }}>
              {src.icon} {src.label}
            </span>
            <TripCategoryBadge category={item.category} confidence={item.categoryConfidence} />
          </div>
        </div>
        <div className="trip-card-details">
          <div className="detail-item"><Calendar size={14} /> {formatDate(item.startedAt)}</div>
          <div className="detail-item"><Clock size={14} /> {formatDuration(item.startedAt, item.endedAt ?? undefined)}</div>
          <div className="detail-item"><AlertCircle size={14} /> {item.eventCounts?.total ?? 0} Eventos</div>
        </div>
        {item.labels?.length > 0 && (
          <div className="trip-card-labels">
            {item.labels.map(l => (
              <span key={l} className="trip-label-tag">{l}</span>
            ))}
          </div>
        )}
      </div>
      <div className="trip-card-right">
        <div className="trip-card-scores">
          <div className="score-badge" style={{ color: safety.color }}>
            <div className="score-circle">{item.safetyScore}</div>
            <span className="score-label">Safety</span>
          </div>
          <div className="score-badge" style={{ color: perf.color }}>
            <div className="score-circle">{item.performanceScore}</div>
            <span className="score-label">Perf</span>
          </div>
        </div>
        <div className="trip-card-stats-row">
          <div className="compact-stat">
            <span className="compact-stat-value">{item.distanceKm?.toFixed(1)}</span>
            <span className="compact-stat-unit">KM</span>
          </div>
          <div className="compact-stat">
            <span className="compact-stat-value">{item.avgSpeedKmh?.toFixed(0)}</span>
            <span className="compact-stat-unit">KM/H</span>
          </div>
        </div>
        <Link to={`/trips/${item.id}`} style={{ width: "100%" }}>
          <button className="btn-premium-action">
            Analisar <ArrowRight size={18} />
          </button>
        </Link>
      </div>
    </div>
  );
}


// ─── List Card ────────────────────────────────────────────────────────────────

function TripListCard({
  trip, expandedId, detailLoadingId, onToggle, selectedForComparison, onCompareToggle,
}: {
  trip: Trip;
  expandedId: string | null;
  detailLoadingId: string | null;
  onToggle: (id: string) => void | Promise<void>;
  selectedForComparison: string[];
  onCompareToggle: (tripId: string) => void;
}) {
  const badge = statusBadge(trip.status);
  const src   = sourceBadge(trip.source);
  const isOpen = expandedId === trip.id;
  const evCount = trip.events?.length ?? trip._count?.events ?? 0;
  const motoImg = imageFromCategory((trip.motorcycle as any)?.category);
  const isSelected = selectedForComparison.includes(trip.id);
  const isDisabled = selectedForComparison.length >= 2 && !isSelected;

  return (
    <div className={`trip-card-premium ${isOpen ? "open" : ""} ${isSelected ? "compare-selected" : ""}`}>
      <div className="trip-card-image" onClick={() => onToggle(trip.id)} style={{ cursor: "pointer" }}>
        <img src={motoImg} alt="moto" />
      </div>
      <div className="trip-card-main">
        <div className="trip-card-header" onClick={() => onToggle(trip.id)} style={{ cursor: "pointer" }}>
          <div className="trip-card-title">{trip.motorcycle?.name}</div>
          <div className="trip-card-badges">
            <span className="trip-premium-badge" style={{ background: badge.bg, color: badge.color }}>
              {badge.icon} {badge.label}
            </span>
            <span className="trip-premium-badge" style={{ background: src.bg, color: src.color }}>
              {src.icon} {src.label}
            </span>
            <TripCategoryBadge category={trip.category} confidence={trip.categoryConfidence} />
          </div>
        </div>
        <div className="trip-card-details">
          <div className="detail-item"><Calendar size={14} /> {formatDate(trip.startedAt)}</div>
          <div className="detail-item"><Clock size={14} /> {formatDuration(trip.startedAt, trip.endedAt)}</div>
          {evCount > 0 && <div className="detail-item" style={{ color: "var(--red)" }}><AlertCircle size={14} /> {evCount} Eventos</div>}
        </div>
        <div className="compare-checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
           <label className="auth-checkbox">
             <input
               type="checkbox"
               checked={isSelected}
               disabled={isDisabled}
               onChange={() => onCompareToggle(trip.id)}
             />
             <span>Comparar</span>
           </label>
        </div>
      </div>
      <div className="trip-card-right">
        <div className="trip-card-stats-row">
          <div className="compact-stat">
            <span className="compact-stat-value">{trip.distanceKm?.toFixed(1) ?? "—"}</span>
            <span className="compact-stat-unit">KM</span>
          </div>
          <div className="compact-stat">
            <span className="compact-stat-value">{trip.avgSpeedKmh?.toFixed(0) ?? "—"}</span>
            <span className="compact-stat-unit">KM/H</span>
          </div>
        </div>
        <button className="btn-premium-action" onClick={() => onToggle(trip.id)}>
          {isOpen ? "Fechar" : "Detalhes"} {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>


        {isOpen && (
          <div className="trip-expanded-content" style={{ gridColumn: "span 3", background: "rgba(0,0,0,0.1)", borderTop: "1px solid var(--glass-border)" }}>
            {detailLoadingId === trip.id ? (
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
                  <Link to={`/trips/${trip.id}`} style={{ width: "100%" }}>
                    <button className="btn-premium-action">
                      <Activity size={18} /> Ver Análise Completa <ArrowRight size={18} />
                    </button>
                  </Link>
                </div>
                {trip.events && trip.events.length > 0 && (
                  <div className="events-section-v2">
                    <div className="section-title-v2">Eventos de Risco Detectados</div>
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
  );
}

