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
  Cpu, Monitor, Info, ChevronUp, History, Activity, Check, AlertTriangle
} from "lucide-react";
import Card from "../components/ui/Card";
import { SkeletonRow, SkeletonCard } from "../components/ui/Skeleton";
import CompareBar from "../components/trips/CompareBar";
import ComparisonView from "../components/trips/ComparisonView";
import { ListStateSnapshot } from "../utils/tripComparison";
import TripCategoryBadge from "../components/trips/TripCategoryBadge";

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
  const startDate = new Date(start);
  const endDate = new Date(end);
  const ms = endDate.getTime() - startDate.getTime();
  const totalMins = Math.floor(ms / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  const secs = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
  if (totalMins > 0) return `${totalMins}m ${String(secs).padStart(2, '0')}s`;
  return `${secs}s`;
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":    return { className: "bg-green/10 text-green border-green/20", label: "Ativa", icon: <Zap size={12} /> };
    case "COMPLETED": return { className: "bg-blue/10 text-blue border-blue/20", label: "Concluída", icon: <Calendar size={12} /> };
    case "CANCELLED": return { className: "bg-red/10 text-red border-red/20", label: "Cancelada", icon: <AlertCircle size={12} /> };
    default:          return { className: "bg-white/10 text-muted border-white/20", label: status, icon: <Info size={12} /> };
  }
}

function sourceBadge(source: TripSource) {
  switch (source) {
    case "SIMULATOR":    return { className: "bg-sky/10 text-sky border-sky/20", label: "Simulador", icon: <Monitor size={12} /> };
    case "GPX_IMPORTED": return { className: "bg-green/10 text-green border-green/20", label: "GPX", icon: <Database size={12} /> };
    case "DEVICE_REAL":  return { className: "bg-pink/10 text-pink border-pink/20", label: "Real", icon: <Cpu size={12} /> };
    default:             return { className: "bg-white/10 text-muted border-white/20", label: source, icon: <Route size={12} /> };
  }
}

function severityColorClass(severity: string) {
  switch (severity) {
    case "CRITICAL": return "border-l-red";
    case "WARNING":  return "border-l-yellow";
    default:         return "border-l-muted/30";
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
  if (score >= 80) return { className: "text-green", bg: "bg-green/10" };
  if (score >= 60) return { className: "text-yellow", bg: "bg-yellow/10" };
  return              { className: "text-red", bg: "bg-red/10" };
}

// ─── Moto Card ────────────────────────────────────────────────────────────────

function MotoCard({ moto, selected, tripCount, onClick }: {
  moto: Motorcycle; selected: boolean; tripCount: number; onClick: () => void;
}) {
  const img = imageFromCategory(moto.category);
  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-52 h-36 rounded-2xl border transition-all cursor-pointer flex flex-col group relative overflow-hidden ${selected ? "bg-accent/10 border-accent/40 shadow-lg shadow-accent/20 scale-[1.02]" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"}`}
    >
      <img src={img} alt={moto.name} className="moto-card-bg" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-surface/40 to-transparent pointer-events-none" />
      <div className="p-4 relative z-10 flex-1 flex flex-col justify-end">
        <div className="flex flex-col gap-0.5">
          <div className="font-black text-sm text-text truncate leading-tight group-hover:text-accent transition-colors">{moto.name}</div>
          <div className="text-[0.6rem] font-bold text-muted uppercase tracking-widest opacity-80 truncate">
            {moto.brand} {moto.model}
          </div>
        </div>
        <div className="flex items-center mt-2">
          <span className="text-[0.6rem] font-black text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-lg uppercase tracking-widest shadow-inner">
            {tripCount} viagens
          </span>
        </div>
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

  useEffect(() => { void refresh(); setExpandedId(null); setPage(1); }, [view, sourceFilter, statusFilter]);

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
      const res = await tripsAPI.getAll(
        sourceFilter === "ALL" ? undefined : sourceFilter,
        statusFilter === "ALL" ? undefined : statusFilter,
      );
      setTrips(res.data);
    } catch { setError("Não foi possível carregar as viagens."); }
    finally { setIsLoading(false); }
  }

  async function loadFeed() {
    try {
      setFeedLoading(true); setFeedError(null);
      const res = await tripsAPI.getFeed(
        sourceFilter === "ALL" ? undefined : sourceFilter,
        statusFilter === "ALL" ? undefined : statusFilter,
        200,
      );
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
  const safetyValues = (view === "FEED" ? filteredFeed : filteredTrips)
    .map((t) => t.safetyScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
  const avgSafety = safetyValues.length
    ? safetyValues.reduce((acc, score) => acc + score, 0) / safetyValues.length
    : null;


  // ── Loading ──────────────────────────────────────────────────────────────
  if (activeLoading && motosLoading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <History className="text-accent" size={32} />
          <h1 className="text-3xl font-black text-text tracking-tight m-0">Histórico de Viagens</h1>
        </div>
        <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
        <div className="w-24 h-24 rounded-full bg-red/10 flex items-center justify-center text-red border border-red/20 shadow-2xl">
          <AlertCircle size={48} />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-text tracking-tight">Erro ao carregar viagens</h2>
          <p className="text-muted text-sm font-medium max-w-xs">{activeError}</p>
        </div>
        <button className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:scale-105 transition-all" onClick={() => void refresh()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <History className="text-accent" size={32} /> Histórico de Viagens
          </h1>
          <p className="text-muted text-sm font-medium flex items-center gap-2">
            <Route size={16} className="text-accent/60" /> Explore e analise o seu histórico de condução premium.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner">
          <button className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${view === "FEED" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text"}`}
            onClick={() => { setView("FEED"); setExpandedId(null); setPage(1); }}>
            <Activity size={18} /> Feed
          </button>
          <button className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[0.65rem] font-black uppercase tracking-widest transition-all ${view === "LIST" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text"}`}
            onClick={() => { setView("LIST"); setExpandedId(null); setPage(1); }}>
            <History size={18} /> Lista
          </button>
        </div>
      </div>

      {/* HERO SUMMARY */}
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-10 flex flex-col md:flex-row items-center justify-between gap-10 overflow-hidden shadow-2xl relative group">
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-accent/10 blur-[120px] pointer-events-none group-hover:bg-accent/20 transition-colors" />
        
        <div className="flex gap-16 flex-wrap justify-center md:justify-start relative z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Total Viagens</span>
            <span className="text-5xl font-black text-text tracking-tighter tabular-nums">{activeCount}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Distância Total</span>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-text tracking-tighter tabular-nums">{totalKm.toFixed(1)}</span>
              <span className="text-xs font-black text-muted opacity-40 uppercase tracking-widest">KM</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Safety Score Médio</span>
            <span className={`text-5xl font-black tracking-tighter tabular-nums transition-colors ${avgSafety === null ? "text-muted" : scoreStyle(avgSafety).className}`}>
              {avgSafety === null ? "—" : avgSafety.toFixed(0)}
            </span>
          </div>
        </div>

        <div className="relative w-28 h-28 rounded-full bg-black/20 flex items-center justify-center border border-white/5 shadow-inner group-hover:border-accent/40 transition-all shrink-0">
          <Activity size={56} className="text-accent opacity-20" />
          <div className="absolute inset-0 rounded-full border-2 border-accent animate-ping opacity-0 group-hover:opacity-10 transition-opacity" />
        </div>
      </div>

      {/* MOTO SELECTOR */}
      {motos.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="text-[0.65rem] font-black uppercase tracking-widest text-muted ml-1 flex items-center gap-2 opacity-60">
            <Bike size={14} className="text-accent" /> Filtrar por Mota
          </div>
          <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-none px-1">
            <div
              onClick={() => { setSelectedMotoId("ALL"); setPage(1); setExpandedId(null); }}
              className={`flex-shrink-0 w-52 p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 group relative overflow-hidden ${selectedMotoId === "ALL" ? "bg-accent/10 border-accent/40 shadow-lg shadow-accent/5 scale-[1.02]" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"}`}
            >
              <div className="w-full h-24 rounded-xl bg-accent/5 flex items-center justify-center text-accent/40 group-hover:scale-105 transition-transform">
                <Bike size={48} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-black text-sm text-text">Todas</span>
                <span className="text-[0.6rem] font-bold text-muted uppercase tracking-widest opacity-40">Histórico Total</span>
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

      {/* FILTERS */}
      <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 flex flex-col gap-8 shadow-xl">
        <div className="flex items-center gap-3 text-[0.65rem] font-black uppercase tracking-widest text-text opacity-80">
          <div className="w-1.5 h-1.5 rounded-full bg-accent" />
          Filtros Inteligentes
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          <div className="flex flex-col gap-2.5">
            <label className="text-[0.6rem] font-black uppercase tracking-widest text-muted ml-1 opacity-60">Origem</label>
            <select className="bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[0.7rem] font-black uppercase tracking-widest text-text focus:outline-none focus:border-accent transition-all cursor-pointer" value={sourceFilter}
              onChange={(e) => {
                const nextSource = e.target.value as TripSourceFilter;
                setSourceFilter(nextSource);
                // Evita estado "sem resultados" por filtros herdados de outra origem.
                setSelectedMotoId("ALL");
                if (nextSource === "GPX_IMPORTED" && statusFilter === "ACTIVE") {
                  setStatusFilter("COMPLETED");
                }
                setPage(1);
                setExpandedId(null);
              }}>
              <option value="ALL" className="bg-slate-900">Todas</option>
              <option value="SIMULATOR" className="bg-slate-900">Simulador IoT</option>
              <option value="GPX_IMPORTED" className="bg-slate-900">Ficheiros GPX</option>
              <option value="DEVICE_REAL" className="bg-slate-900">Dispositivo Real</option>
            </select>
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-[0.6rem] font-black uppercase tracking-widest text-muted ml-1 opacity-60">Estado</label>
            <select className="bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[0.7rem] font-black uppercase tracking-widest text-text focus:outline-none focus:border-accent transition-all cursor-pointer" value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as TripStatusFilter); setPage(1); setExpandedId(null); }}>
              <option value="ALL" className="bg-slate-900">Todos</option>
              <option value="ACTIVE" className="bg-slate-900">Ativas</option>
              <option value="COMPLETED" className="bg-slate-900">Concluídas</option>
              <option value="CANCELLED" className="bg-slate-900">Canceladas</option>
            </select>
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-[0.6rem] font-black uppercase tracking-widest text-muted ml-1 opacity-60">De</label>
            <input className="bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[0.7rem] font-black text-text focus:outline-none focus:border-accent transition-all" type="date" value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); setExpandedId(null); }} />
          </div>
          <div className="flex flex-col gap-2.5">
            <label className="text-[0.6rem] font-black uppercase tracking-widest text-muted ml-1 opacity-60">Até</label>
            <input className="bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-[0.7rem] font-black text-text focus:outline-none focus:border-accent transition-all" type="date" value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); setExpandedId(null); }} />
          </div>
          <div className="flex items-center pt-6 justify-center">
             <label className="flex items-center gap-3 cursor-pointer group">
               <div className={`w-12 h-7 rounded-full transition-all relative flex items-center px-1.5 shadow-inner ${onlyWithEvents ? 'bg-accent' : 'bg-white/10'}`}>
                 <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-xl ${onlyWithEvents ? 'translate-x-5' : 'translate-x-0'}`} />
               </div>
               <input type="checkbox" className="hidden" checked={onlyWithEvents}
                 onChange={(e) => { setOnlyWithEvents(e.target.checked); setPage(1); setExpandedId(null); }} />
               <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted group-hover:text-text transition-colors">Apenas Eventos</span>
             </label>
          </div>
        </div>
      </div>

      {activeCount === 0 && (
        <div className="flex flex-col items-center justify-center py-32 text-center gap-8">
          <div className="w-28 h-28 rounded-full bg-white/5 flex items-center justify-center text-muted/10 border border-white/5 shadow-inner">
            <Route size={64} />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-2xl font-black text-text m-0 tracking-tight">Sem viagens encontradas</h3>
            <p className="text-muted text-sm font-medium max-w-sm m-0 leading-relaxed opacity-60">
              {selectedMotoId !== "ALL"
                ? "Esta mota ainda não tem viagens que correspondam aos filtros aplicados."
                : "Inicie uma simulação no simulador IoT ou importe um ficheiro GPX para ver resultados aqui."}
            </p>
            {(sourceFilter !== "ALL" || statusFilter !== "ALL") && (
              <p className="text-xs text-muted/70 font-semibold uppercase tracking-wider m-0">
                Filtros ativos: origem={sourceFilter} | estado={statusFilter}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {view === "FEED" ? (
          <div className="grid grid-cols-1 gap-8">
            {pagedFeed.map((item) => <TripFeedCard key={item.id} item={item} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-8 py-8 mt-4 border-t border-white/5 shrink-0">
          <div className="flex items-center gap-5">
            <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted opacity-60">Itens por página</span>
            <select className="bg-white/5 border border-white/5 rounded-xl px-4 py-2 text-[0.7rem] font-black text-text focus:outline-none focus:border-accent transition-all cursor-pointer"
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); setExpandedId(null); }}>
              {[5, 10, 20, 50].map((n) => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-6">
            <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 disabled:opacity-20 transition-all active:scale-90 shadow-lg" disabled={safePage <= 1}
              onClick={() => { setPage((p) => Math.max(1, p - 1)); setExpandedId(null); }}>
              <ChevronLeft size={24} />
            </button>
            <span className="text-sm font-black text-text tracking-tight uppercase tracking-widest tabular-nums px-2">
              <span className="text-accent">{safePage}</span> / {totalPages}
            </span>
            <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 disabled:opacity-20 transition-all active:scale-90 shadow-lg" disabled={safePage >= totalPages}
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); setExpandedId(null); }}>
              <ChevronRight size={24} />
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
    <div className="flex flex-col lg:flex-row bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden group hover:border-accent/30 transition-all shadow-2xl hover:shadow-accent/5 relative min-h-[220px]">
      <img src={motoImg} alt="moto" className="absolute left-1/2 top-1/2 -translate-x-[60%] -translate-y-1/2 w-[80%] h-[150%] opacity-[0.15] object-contain drop-shadow-2xl transition-transform duration-700 ease-out group-hover:scale-[1.05] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface/40 via-transparent to-surface/80 pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex-1 p-10 flex flex-col justify-center gap-8 relative z-10">
        <div className="flex flex-col gap-4">
          <h3 className="text-2xl font-black text-text tracking-tight m-0">{item.motorcycle?.name}</h3>
          <div className="flex flex-wrap gap-2.5">
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[0.6rem] font-black uppercase tracking-widest border ${badge.className}`}>
              {badge.icon} {badge.label}
            </span>
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[0.6rem] font-black uppercase tracking-widest border ${src.className}`}>
              {src.icon} {src.label}
            </span>
            <TripCategoryBadge category={item.category} confidence={item.categoryConfidence} />
          </div>
        </div>
        <div className="flex flex-wrap gap-8 items-center">
          <div className="flex items-center gap-2.5 text-xs font-bold text-muted hover:text-text transition-colors">
            <Calendar size={16} className="text-accent/60" /> {formatDate(item.startedAt)}
          </div>
          <div className="flex items-center gap-2.5 text-xs font-bold text-muted hover:text-text transition-colors">
            <Clock size={16} className="text-accent/60" /> {formatDuration(item.startedAt, item.endedAt ?? undefined)}
          </div>
          <div className={`flex items-center gap-2.5 text-xs font-black uppercase tracking-widest ${item.eventCounts?.total > 0 ? 'text-red' : 'text-green opacity-40'}`}>
            <AlertCircle size={16} /> {item.eventCounts?.total ?? 0} Eventos
          </div>
        </div>
        {item.labels?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.labels.map(l => (
              <span key={l} className="px-3 py-1 rounded-xl bg-accent/5 border border-accent/20 text-accent text-[0.6rem] font-black uppercase tracking-widest">{l}</span>
            ))}
          </div>
        )}
      </div>
      <div className="lg:w-80 p-10 lg:border-l border-white/5 bg-black/10 flex flex-col justify-center items-center gap-10 shrink-0 relative">
        <div className="flex gap-8">
          <div className={`flex flex-col items-center gap-2 group/score ${safety.className}`}>
            <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center text-xl font-black bg-black/40 shadow-inner group-hover/score:scale-110 transition-transform tabular-nums">{item.safetyScore}</div>
            <span className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Safety</span>
          </div>
          <div className={`flex flex-col items-center gap-2 group/score ${perf.className}`}>
            <div className="w-16 h-16 rounded-full border-2 border-current flex items-center justify-center text-xl font-black bg-black/40 shadow-inner group-hover/score:scale-110 transition-transform tabular-nums">{item.performanceScore}</div>
            <span className="text-[0.55rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">Perf</span>
          </div>
        </div>
        <div className="flex gap-10 justify-center w-full">
          <div className="flex flex-col items-center group/stat">
            <span className="text-2xl font-black text-text tracking-tighter group-hover/stat:text-accent transition-colors tabular-nums">{item.distanceKm?.toFixed(1)}</span>
            <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">KM</span>
          </div>
          <div className="flex flex-col items-center group/stat">
            <span className="text-2xl font-black text-text tracking-tighter group-hover/stat:text-accent transition-colors tabular-nums">{item.avgSpeedKmh?.toFixed(0)}</span>
            <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">KM/H</span>
          </div>
        </div>
        <Link to={`/trips/${item.id}`} className="w-full">
          <button className="w-full flex items-center justify-center gap-3 bg-accent text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all group/btn">
            Analisar <ArrowRight size={20} className="transition-transform group-hover/btn:translate-x-2" />
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
    <div className={`flex flex-col bg-surface/40 backdrop-blur-xl border rounded-[2rem] overflow-hidden transition-all duration-500 relative min-h-[160px] ${isOpen ? 'border-accent/40 shadow-2xl shadow-accent/5' : 'border-white/10 hover:border-white/20'}`}>
      <img src={motoImg} alt="moto" className="absolute left-1/2 top-1/2 -translate-x-[60%] -translate-y-1/2 w-[80%] h-[150%] opacity-[0.15] object-contain drop-shadow-2xl transition-transform duration-700 ease-out group-hover:scale-[1.05] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-surface/40 via-transparent to-surface/80 pointer-events-none" />
      
      <div className="flex flex-col lg:flex-row min-h-[160px] relative z-10">
        <div className="flex-1 p-8 flex flex-col justify-center gap-6 cursor-pointer" onClick={() => onToggle(trip.id)}>
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-black text-text tracking-tight m-0 leading-none">{trip.motorcycle?.name}</h3>
          <div className="flex flex-wrap gap-2.5">
            <span className={`flex items-center gap-2 px-3 py-1 rounded-xl text-[0.6rem] font-black uppercase tracking-widest border ${badge.className}`}>
              {badge.icon} {badge.label}
            </span>
            <span className={`flex items-center gap-2 px-3 py-1 rounded-xl text-[0.6rem] font-black uppercase tracking-widest border ${src.className}`}>
              {src.icon} {src.label}
            </span>
            <TripCategoryBadge category={trip.category} confidence={trip.categoryConfidence} />
          </div>
          </div>
          <div className="flex flex-wrap gap-8 items-center">
            <div className="flex items-center gap-2.5 text-[0.7rem] font-bold text-muted hover:text-text transition-colors">
              <Calendar size={14} className="text-accent/60" /> {formatDate(trip.startedAt)}
            </div>
            <div className="flex items-center gap-2.5 text-[0.7rem] font-bold text-muted hover:text-text transition-colors">
              <Clock size={14} className="text-accent/60" /> {formatDuration(trip.startedAt, trip.endedAt)}
            </div>
            {evCount > 0 && (
              <div className="flex items-center gap-2.5 text-[0.7rem] font-black uppercase tracking-widest text-red">
                <AlertCircle size={14} /> {evCount} Eventos
              </div>
            )}
          </div>
          <div className="flex items-center mt-1" onClick={(e) => e.stopPropagation()}>
             <label className={`flex items-center gap-3 cursor-pointer group transition-opacity ${isDisabled ? 'opacity-30 grayscale cursor-not-allowed' : 'opacity-100'}`}>
               <input
                 type="checkbox"
                 className="hidden"
                 checked={isSelected}
                 disabled={isDisabled}
                 onChange={() => onCompareToggle(trip.id)}
               />
               <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-accent border-accent shadow-lg shadow-accent/20' : 'border-white/10 group-hover:border-white/30 bg-black/20'}`}>
                 {isSelected && <Check size={16} className="text-white" strokeWidth={4} />}
               </div>
               <span className={`text-[0.65rem] font-black uppercase tracking-widest transition-colors ${isSelected ? 'text-accent' : 'text-muted group-hover:text-text'}`}>Comparar Viagem</span>
             </label>
          </div>
        </div>
        <div className="lg:w-72 p-8 lg:border-l border-white/5 bg-black/10 flex flex-col justify-center items-end gap-8 shrink-0">
          <div className="flex gap-8 justify-end w-full">
            <div className="flex flex-col items-end group/stat">
              <span className="text-xl font-black text-text tracking-tighter tabular-nums">{trip.distanceKm?.toFixed(1) ?? "—"}</span>
              <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">KM</span>
            </div>
            <div className="flex flex-col items-end group/stat">
              <span className="text-xl font-black text-text tracking-tighter tabular-nums">{trip.avgSpeedKmh?.toFixed(0) ?? "—"}</span>
              <span className="text-[0.6rem] font-black text-muted uppercase tracking-widest opacity-40">KM/H</span>
            </div>
          </div>
          <button className={`w-full flex items-center justify-center gap-3 py-3 rounded-2xl font-black text-[0.7rem] uppercase tracking-widest transition-all ${isOpen ? 'bg-white/10 text-text border border-white/10' : 'bg-accent text-white shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98]'}`} onClick={() => onToggle(trip.id)}>
            {isOpen ? "Ocultar" : "Detalhes"} {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="bg-black/20 border-t border-white/5 p-10 animate-slide-down">
          {detailLoadingId === trip.id ? (
            <div className="flex flex-col items-center justify-center py-12 gap-5">
              <div className="w-10 h-10 rounded-full border-4 border-accent/10 border-t-accent animate-spin" />
              <span className="text-[0.6rem] font-black uppercase tracking-[0.2em] text-muted animate-pulse">A extrair telemetria...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Vel. Máxima", val: `${trip.maxSpeedKmh?.toFixed(1) ?? "—"}`, unit: "km/h", icon: <Zap size={14} /> },
                  { label: "Vel. Média", val: `${trip.avgSpeedKmh?.toFixed(1) ?? "—"}`, unit: "km/h", icon: <Activity size={14} /> },
                  { label: "Inclinação Máx.", val: `${trip.maxRollDeg?.toFixed(1) ?? "—"}`, unit: "°", icon: <History size={14} /> },
                  { label: "Força G Máx.", val: `${trip.maxGForce?.toFixed(2) ?? "—"}`, unit: "G", icon: <Cpu size={14} /> }
                ].map(stat => (
                  <div key={stat.label} className="bg-white/5 border border-white/5 rounded-3xl p-6 flex flex-col gap-2 hover:border-accent/30 transition-colors shadow-inner group/mini">
                    <div className="flex items-center gap-2 text-[0.55rem] font-black uppercase tracking-[0.15em] text-muted opacity-60">
                       <span className="text-accent group-hover/mini:scale-110 transition-transform">{stat.icon}</span>
                       {stat.label}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-text tracking-tighter tabular-nums">{stat.val}</span>
                      <span className="text-[0.6rem] font-bold text-muted opacity-40 uppercase tracking-widest">{stat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <Link to={`/trips/${trip.id}`} className="group/btn">
                <button className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 py-5 rounded-2xl font-black text-sm text-text transition-all group-hover/btn:border-accent/40 shadow-xl">
                  <Activity size={20} className="text-accent group-hover/btn:scale-125 transition-transform" /> Ver Relatório Pós‑Viagem Completo <ArrowRight size={20} className="transition-transform group-hover/btn:translate-x-3" />
                </button>
              </Link>

              {trip.events && trip.events.length > 0 && (
                <div className="flex flex-col gap-6 pt-4">
                  <div className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-red/80 flex items-center gap-3 px-1">
                    <AlertTriangle size={16} /> Incidentes e Alertas de Risco
                    <div className="flex-1 h-px bg-gradient-to-r from-red/20 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {trip.events.map((ev) => (
                      <div key={ev.id} className={`flex items-center gap-5 p-5 rounded-3xl bg-black/40 border border-white/5 border-l-4 group/ev hover:bg-black/60 transition-colors ${severityColorClass(ev.severity)}`}>
                        <span className="text-3xl group-hover/ev:scale-125 transition-transform drop-shadow-lg shrink-0">{eventTypeIcon(ev.type)}</span>
                        <div className="flex flex-col flex-1 gap-1.5 min-w-0">
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-[0.85rem] font-black text-text leading-tight truncate">{ev.message}</span>
                            <span className="text-[0.6rem] font-black text-muted opacity-50 uppercase tracking-widest whitespace-nowrap">{new Date(ev.occurredAt).toLocaleTimeString("pt-PT")}</span>
                          </div>
                          {ev.speedKmh != null && (
                            <div className="flex items-center gap-2 text-[0.6rem] font-black uppercase tracking-widest text-accent/60">
                              <Zap size={12} /> {ev.speedKmh.toFixed(0)} km/h • Registado via Telemetria
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

