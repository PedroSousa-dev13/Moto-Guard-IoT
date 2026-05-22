import { useEffect, useMemo, useRef, useState } from "react";
import { tripsAPI } from "../services/api";
import type { TripFeedItem } from "../types";
import Card from "../components/ui/Card";
import { SkeletonTile, SkeletonCard } from "../components/ui/Skeleton";
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ComposedChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { 
  BarChart2, 
  Map, 
  Calendar, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Navigation,
  AlertTriangle,
  Download,
  RefreshCw,
  Clock,
  ChevronDown,
  Menu,
  Image
} from "lucide-react";
import EventHeatmap from "../components/EventHeatmap";
import {
  aggregateFeedSeries,
  computePeriodStats,
  type Granularity,
  type PresetRange,
} from "../utils/analytics";
import { exportCsv, exportChartsPng } from "../utils/export";

type AnalyticsTab = "charts" | "heatmap";

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDay(ts: number) {
  return new Date(ts).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  });
}

function pctChange(curr: number | null, prev: number | null): string {
  if (prev == null || curr == null || prev === 0) return "—";
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

function pctColorClass(curr: number | null, prev: number | null, higherIsBetter = true): string {
  if (prev == null || curr == null || prev === 0) return "text-muted";
  const better = higherIsBetter ? curr >= prev : curr <= prev;
  return better ? "text-green" : "text-red";
}

function NoDataPlaceholder({ className = "min-h-[240px]" }: { className?: string }) {
  return (
    <div 
      className={`flex items-center justify-center w-full font-black text-sm uppercase tracking-widest animate-fade-in ${className}`}
      style={{ color: "rgba(100, 116, 139, 0.4)" }}
    >
      (No data)
    </div>
  );
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>("charts");
  const [range, setRange] = useState<PresetRange>("7d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [feed, setFeed] = useState<TripFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem("analytics_card_order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 6) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return ["activity", "security", "conduction", "trends", "speed", "insights"];
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragActiveIndex, setDragActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem("analytics_card_order", JSON.stringify(cardOrder));
  }, [cardOrder]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    // 1. Record "First" (current) positions
    const firstRects: Record<string, DOMRect> = {};
    cardOrder.forEach((cardId) => {
      const el = cardRefs.current[cardId];
      if (el) {
        firstRects[cardId] = el.getBoundingClientRect();
      }
    });

    const newOrder = [...cardOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);
    setCardOrder(newOrder);
    setDraggedIndex(targetIndex);

    // 2. Invert & Play in requestAnimationFrame
    requestAnimationFrame(() => {
      newOrder.forEach((cardId) => {
        const el = cardRefs.current[cardId];
        const first = firstRects[cardId];
        if (el && first) {
          const last = el.getBoundingClientRect();
          const dx = first.left - last.left;
          const dy = first.top - last.top;

          if (dx !== 0 || dy !== 0) {
            // Apply invert transform with no transition
            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)`;

            // Force reflow
            void el.offsetHeight;

            // Transition smoothly to target position
            el.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
            el.style.transform = 'translate(0, 0)';

            // Clean up inline styles once transition ends
            const cleanup = () => {
              el.style.transition = '';
              el.style.transform = '';
              el.removeEventListener('transitionend', cleanup);
            };
            el.addEventListener('transitionend', cleanup);
          }
        }
      });
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragActiveIndex(null);
  };

  const renderGrabHandle = (index: number) => (
    <div 
      className="cursor-grab active:cursor-grabbing text-muted/30 hover:text-text transition-colors p-1"
      onMouseDown={() => setDragActiveIndex(index)}
      onMouseUp={() => setDragActiveIndex(null)}
      onMouseLeave={() => setDragActiveIndex(null)}
      title="Arrastar para reordenar"
    >
      <Menu size={16} />
    </div>
  );

  useEffect(() => {
    document.title = "Analytics — MotoGuard";
  }, []);

  async function load() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await tripsAPI.getFeed(undefined, undefined, 500);
      setFeed(res.data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Não foi possível carregar analytics.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const series = useMemo(() => {
    return aggregateFeedSeries(feed, {
      range,
      granularity,
      customFrom: from,
      customTo: to,
      now: new Date(),
    });
  }, [feed, from, granularity, range, to]);

  const prevSeries = useMemo(() => {
    const win = series.window;
    const duration = win.to.getTime() - win.from.getTime();
    const prevTo = new Date(win.from.getTime() - 1);
    const prevFrom = new Date(win.from.getTime() - duration);
    const prevFiltered = feed.filter((t) => {
      const ts = new Date(t.startedAt).getTime();
      return ts >= prevFrom.getTime() && ts <= prevTo.getTime();
    });
    return computePeriodStats(prevFiltered);
  }, [feed, series.window]);

  const kpis = useMemo(() => computePeriodStats(series.filtered), [series.filtered]);

  const styleStats = useMemo(() => {
    const counts: Record<string, number> = {
      AGGRESSIVE: 0,
      DEFENSIVE: 0,
      ECONOMY: 0,
    };
    series.filtered.forEach((t) => {
      const style = t.drivingStyle;
      if (style && counts[style] !== undefined) {
        counts[style]++;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [series.filtered]);

  const sortedStyleStats = useMemo(() => {
    return [...styleStats].sort((a, b) => b.value - a.value);
  }, [styleStats]);

  function handleExportCsv() {
    exportCsv(series.filtered, `analytics-${range}.csv`);
  }

  async function handleExportPng() {
    if (!chartsRef.current) return;
    setExporting(true);
    chartsRef.current.classList.add("html2canvas-export");
    try {
      await exportChartsPng(chartsRef.current, `analytics-${range}.png`);
    } finally {
      chartsRef.current.classList.remove("html2canvas-export");
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8 animate-fade-in">
        <div className="flex flex-col gap-1">
          <div className="h-8 w-64 bg-white/5 rounded-lg animate-pulse" />
          <div className="h-4 w-48 bg-white/5 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => <SkeletonCard key={i} lines={12} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center gap-6">
        <div className="w-24 h-24 rounded-full bg-red/10 flex items-center justify-center text-red border border-red/20 shadow-2xl text-4xl">
          ⚠️
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-text tracking-tight">Erro ao carregar analytics</h2>
          <p className="text-muted text-sm font-medium max-w-xs leading-relaxed">{error}</p>
        </div>
        <button className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-accent text-white font-black text-sm shadow-xl shadow-accent/20 hover:scale-105 transition-all" onClick={() => void load()}>
          <RefreshCw size={18} /> Tentar novamente
        </button>
      </div>
    );
  }

  const rangeLabel: Record<PresetRange, string> = {
    "24h": "Hoje",
    "7d": "7 dias",
    "30d": "30 dias",
    "365d": "Ano",
    all: "Tudo",
    custom: "Custom",
  };

  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      {/* Premium Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 pb-4 border-b border-white/5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-accent/20 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
              <BarChart2 size={26} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-text tracking-tighter flex items-center gap-2">
                Analytics <span className="text-muted/40 font-light">&</span> Relatórios
              </h1>
              <div className="flex items-center gap-2 text-muted text-xs font-bold uppercase tracking-widest mt-0.5">
                <Clock size={12} className="text-accent" />
                {lastUpdatedAt ? `Sincronizado: ${formatDateTime(lastUpdatedAt)}` : "—"}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {activeTab === "charts" && (
            <div className="flex items-center gap-3 glass-panel p-1 rounded-2xl">
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-hover:text-accent transition-colors" size={14} />
                <select
                  className="bg-black/40 border border-white/5 rounded-xl pl-9 pr-8 py-2.5 text-xs text-text font-black uppercase tracking-widest focus:border-accent outline-none appearance-none cursor-pointer min-w-[160px]"
                  value={range}
                  onChange={(e) => setRange(e.target.value as PresetRange)}
                >
                  <option value="24h">Hoje (24h)</option>
                  <option value="7d">Semana (7d)</option>
                  <option value="30d">Mês (30d)</option>
                  <option value="365d">Ano (365d)</option>
                  <option value="all">Histórico</option>
                  <option value="custom">Customizado</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                  <ChevronDown size={14} />
                </div>
              </div>

              <div className="relative group">
                <select
                  className="bg-black/40 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-text font-black uppercase tracking-widest focus:border-accent outline-none appearance-none cursor-pointer w-[110px]"
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as Granularity)}
                >
                  <option value="hour">Hora</option>
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                  <ChevronDown size={14} />
                </div>
              </div>

              <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
                <button className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-white/5 transition-all" onClick={() => void load()} title="Atualizar">
                  <RefreshCw size={16} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-white/5 transition-all disabled:opacity-30"
                  onClick={handleExportCsv}
                  disabled={series.filtered.length === 0}
                  title="Exportar CSV"
                >
                  <Download size={16} />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-white/5 transition-all disabled:opacity-30"
                  onClick={() => void handleExportPng()}
                  disabled={exporting || series.points.length === 0}
                  title="Exportar Imagem"
                >
                  {exporting ? <RefreshCw size={16} className="animate-spin" /> : <Image size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="glass-panel p-1 flex gap-1 rounded-2xl">
            <button
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "charts" ? "bg-accent text-white shadow-lg shadow-accent/30" : "text-muted hover:text-text hover:bg-white/5"}`}
              onClick={() => setActiveTab("charts")}
            >
              <BarChart2 size={14} /> Performance
            </button>
            <button
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "heatmap" ? "bg-accent text-white shadow-lg shadow-accent/30" : "text-muted hover:text-text hover:bg-white/5"}`}
              onClick={() => setActiveTab("heatmap")}
            >
              <Map size={14} /> Geográfico
            </button>
          </div>
        </div>
      </div>

      {activeTab === "heatmap" && (
        <div className="bg-surface/60 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-xl animate-fade-in">
          <div className="flex flex-col gap-2 mb-8">
            <h3 className="text-xl font-black text-text m-0 tracking-tight">Mapa de Calor de Eventos</h3>
            <p className="text-muted text-sm font-medium m-0">Distribuição geográfica de incidentes críticos detetados em todas as viagens.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/5 shadow-inner bg-black/20">
            <EventHeatmap />
          </div>
        </div>
      )}

      {activeTab === "charts" && (
        <>
          {range === "custom" && (
            <Card title="Intervalo Customizado">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="analytics-from">Data de Início</label>
                  <input
                    id="analytics-from"
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[0.7rem] font-black uppercase tracking-widest text-muted ml-1" htmlFor="analytics-to">Data de Fim</label>
                  <input
                    id="analytics-to"
                    className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text font-black focus:border-accent outline-none"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
            </Card>
          )}

          <div ref={chartsRef} className="flex flex-col gap-8 p-6 -m-6 rounded-3xl bg-[#06060c]">
            {/* KPI Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { 
                label: "Distância Total", 
                curr: kpis.distanceKm, 
                prev: prevSeries.distanceKm, 
                fmt: (v: number | null) => v != null ? `${v.toFixed(1)} km` : "—", 
                higher: true,
                icon: <Navigation size={22} />,
                color: "blue"
              },
              { 
                label: "Safety Score", 
                curr: kpis.safetyAvg, 
                prev: prevSeries.safetyAvg, 
                fmt: (v: number | null) => v != null ? `${v.toFixed(0)}/100` : "—", 
                higher: true,
                icon: <ShieldCheck size={22} />,
                color: "green"
              },
              { 
                label: "Performance", 
                curr: kpis.performanceAvg, 
                prev: prevSeries.performanceAvg, 
                fmt: (v: number | null) => v != null ? `${v.toFixed(0)}/100` : "—", 
                higher: true,
                icon: <Zap size={22} />,
                color: "orange"
              },
              { 
                label: "Incidentes Críticos", 
                curr: kpis.criticalEvents, 
                prev: prevSeries.criticalEvents, 
                fmt: (v: number | null) => v != null ? String(v) : "—", 
                higher: false,
                icon: <AlertTriangle size={22} />,
                color: "red"
              },
            ].map(({ label, curr, prev, fmt, higher, icon, color }) => {
              const colorMap: Record<string, string> = {
                blue: "bg-blue/20 text-blue border-blue/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]",
                green: "bg-green/20 text-green border-green/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]",
                orange: "bg-orange/20 text-orange border-orange/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
                red: "bg-red/20 text-red border-red/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              };
              const isBetter = higher ? (curr ?? 0) >= (prev ?? 0) : (curr ?? 0) <= (prev ?? 0);
              return (
                <div key={label} className="glass-panel rounded-3xl p-6 group hover:border-white/20 transition-all hover:scale-[1.02] cursor-default">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${colorMap[color]}`}>
                      {icon}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className={`text-xs font-black flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5 ${ isBetter ? 'text-green' : 'text-red' }`}>
                        <TrendingUp size={12} className={isBetter ? "" : "rotate-180"} />
                        {pctChange(curr, prev)}
                      </div>
                      <div className="text-[0.6rem] text-muted font-bold uppercase tracking-widest mt-1.5 opacity-60">vs anterior</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted opacity-60">{label}</div>
                    <div className="text-3xl font-black text-text tracking-tighter tabular-nums">{fmt(curr)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
            {cardOrder.map((cardId, index) => {
              const dragProps = {
                ref: (el: HTMLDivElement | null) => { cardRefs.current[cardId] = el; },
                draggable: dragActiveIndex === index,
                onDragStart: () => handleDragStart(index),
                onDragEnter: () => handleDragEnter(index),
                onDragEnd: handleDragEnd,
                onDragOver: (e: React.DragEvent) => e.preventDefault(),
                className: `transition-all duration-300 ${draggedIndex === index ? "opacity-30 scale-[0.98] border-accent/30 shadow-[0_0_20px_rgba(139,92,246,0.15)] rounded-xl" : ""}`
              };

              if (cardId === "activity") {
                return (
                  <div key="activity" {...dragProps}>
                    <Card 
                      title="Resumo de Atividade" 
                      subtitle="Correlação entre volume de viagens e distância percorrida"
                      className="overflow-hidden h-full"
                      headerActions={renderGrabHandle(index)}
                    >
                      {series.points.length === 0 ? (
                        <NoDataPlaceholder className="min-h-[320px]" />
                      ) : (
                        <ResponsiveContainer width="100%" height={320}>
                          <ComposedChart data={series.points}>
                            <defs>
                              <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.4}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis 
                              dataKey="t" 
                              tickFormatter={(v) => formatShortDay(v as number)} 
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                              dy={15}
                            />
                            <YAxis 
                              yAxisId="left"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                              dx={-10}
                            />
                            <YAxis 
                              yAxisId="right" 
                              orientation="right"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                              dx={10}
                            />
                            <Tooltip 
                              labelFormatter={(v) => formatTs(v as number)}
                              contentStyle={{ 
                                background: "rgba(13,13,27,0.8)", 
                                border: "1px solid rgba(255,255,255,0.1)", 
                                borderRadius: "16px", 
                                backdropFilter: "blur(20px)", 
                                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                                padding: "12px"
                              }}
                              itemStyle={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.5px" }}
                              cursor={{ stroke: "#8b5cf6", strokeWidth: 1, strokeDasharray: "4 4" }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right" 
                              height={40} 
                              iconType="circle" 
                              wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", paddingBottom: "20px" }} 
                            />
                            <Area 
                              yAxisId="left"
                              type="monotone" 
                              dataKey="distanceKm" 
                              stroke="#8b5cf6" 
                              strokeWidth={4}
                              fillOpacity={1}
                              fill="url(#colorDist)"
                              name="Distância (km)" 
                              animationDuration={1500}
                              isAnimationActive={!exporting}
                            />
                            <Bar 
                              yAxisId="right"
                              dataKey="tripCount" 
                              fill="url(#colorTrips)" 
                              radius={[6, 6, 0, 0]}
                              name="Nº Viagens" 
                              barSize={24}
                              animationDuration={1500}
                              isAnimationActive={!exporting}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  </div>
                );
              }

              if (cardId === "security") {
                return (
                  <div key="security" {...dragProps}>
                    <Card 
                      title="Perfil de Segurança & Risco" 
                      subtitle="Distribuição de eventos por nível de severidade"
                      className="overflow-hidden h-full"
                      headerActions={renderGrabHandle(index)}
                    >
                      {series.points.length === 0 ? (
                        <NoDataPlaceholder className="min-h-[320px]" />
                      ) : (
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={series.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis 
                              dataKey="t" 
                              tickFormatter={(v) => formatShortDay(v as number)}
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                              dy={15}
                            />
                            <YAxis 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                            />
                            <Tooltip 
                              labelFormatter={(v) => formatTs(v as number)}
                              contentStyle={{ 
                                background: "rgba(13,13,27,0.8)", 
                                border: "1px solid rgba(255,255,255,0.1)", 
                                borderRadius: "16px", 
                                backdropFilter: "blur(20px)", 
                                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
                              }}
                              itemStyle={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase" }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right" 
                              height={40} 
                              iconType="circle" 
                              wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", paddingBottom: "20px" }} 
                            />
                            <Bar dataKey="criticalEvents" fill="#ef4444" name="Crítico" stackId="ev" radius={[0, 0, 0, 0]} animationDuration={1500} isAnimationActive={!exporting} />
                            <Bar dataKey="warningEvents" fill="#f59e0b" name="Aviso" stackId="ev" radius={[0, 0, 0, 0]} animationDuration={1500} isAnimationActive={!exporting} />
                            <Bar dataKey="infoEvents" fill="#8b5cf6" name="Info" stackId="ev" radius={[6, 6, 0, 0]} animationDuration={1500} isAnimationActive={!exporting} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  </div>
                );
              }

              if (cardId === "conduction") {
                return (
                  <div key="conduction" {...dragProps}>
                    <Card 
                      title="Perfil de Condução (ML Clustering)" 
                      subtitle="Distribuição baseada em padrões de telemetria"
                      className="overflow-hidden h-full"
                      headerActions={renderGrabHandle(index)}
                    >
                      {series.points.length === 0 || !styleStats.some(s => s.value > 0) ? (
                        <NoDataPlaceholder className="min-h-[260px]" />
                      ) : (
                        <div className="flex flex-col items-center justify-between h-full py-1">
                          <ResponsiveContainer width="100%" height={240}>
                            <PieChart>
                              <Pie
                                data={styleStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                isAnimationActive={!exporting}
                              >
                                {styleStats.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={
                                      entry.name === "AGGRESSIVE" ? "#ef4444" : 
                                      entry.name === "DEFENSIVE" ? "#10b981" : "#3b82f6"
                                    } 
                                  />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ background: "rgba(13,13,13,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex gap-4 mt-2">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red" />
                              <span className="text-[0.65rem] font-black uppercase text-muted">Agressivo</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green" />
                              <span className="text-[0.65rem] font-black uppercase text-muted">Defensivo</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue" />
                              <span className="text-[0.65rem] font-black uppercase text-muted">Económico</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                );
              }

              if (cardId === "trends") {
                return (
                  <div key="trends" {...dragProps}>
                    <Card 
                      title="Tendências de Comportamento" 
                      subtitle="Evolução dos scores de segurança e performance"
                      className="overflow-hidden h-full"
                      headerActions={renderGrabHandle(index)}
                    >
                      {series.points.length === 0 ? (
                        <NoDataPlaceholder className="min-h-[280px]" />
                      ) : (
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={series.points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis 
                              dataKey="t" 
                              tickFormatter={(v) => formatShortDay(v as number)}
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                              axisLine={false}
                              tickLine={false}
                              dy={15}
                            />
                            <YAxis 
                              domain={[0, 100]} 
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
                            />
                            <Tooltip 
                              labelFormatter={(v) => formatTs(v as number)}
                              contentStyle={{ 
                                background: "rgba(13,13,27,0.8)", 
                                border: "1px solid rgba(255,255,255,0.1)", 
                                borderRadius: "16px", 
                                backdropFilter: "blur(20px)", 
                                boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
                              }}
                              itemStyle={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase" }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right" 
                              height={40} 
                              iconType="circle" 
                              wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "1px", paddingBottom: "20px" }} 
                            />
                            <Line 
                              type="monotone" 
                              dataKey="safetyAvg" 
                              stroke="#10b981" 
                              strokeWidth={5}
                              dot={{ r: 5, strokeWidth: 2, fill: "#06060c", stroke: "#10b981" }}
                              activeDot={{ r: 8, strokeWidth: 0, fill: "#10b981" }}
                              name="Safety Score" 
                              animationDuration={1500}
                              isAnimationActive={!exporting}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="performanceAvg" 
                              stroke="#8b5cf6" 
                              strokeWidth={5}
                              dot={{ r: 5, strokeWidth: 2, fill: "#06060c", stroke: "#8b5cf6" }}
                              activeDot={{ r: 8, strokeWidth: 0, fill: "#8b5cf6" }}
                              name="Performance" 
                              animationDuration={1500}
                              isAnimationActive={!exporting}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  </div>
                );
              }

              if (cardId === "speed") {
                return (
                  <div key="speed" {...dragProps}>
                    <Card 
                      title="Dinâmica de Velocidade" 
                      subtitle="Média de velocidade registada por período"
                      className="overflow-hidden h-full"
                      headerActions={renderGrabHandle(index)}
                    >
                      {series.points.length === 0 ? (
                        <NoDataPlaceholder className="min-h-[280px]" />
                      ) : (
                        <AreaChartWrapper data={series.points} isAnimationActive={!exporting} />
                      )}
                    </Card>
                  </div>
                );
              }

              if (cardId === "insights") {
                return (
                  <div key="insights" {...dragProps}>
                    <Card 
                      title="Insights de Estilo (AI)" 
                      subtitle="Análise comparativa de padrões de condução"
                      className="overflow-hidden h-full"
                      headerActions={renderGrabHandle(index)}
                    >
                      {series.points.length === 0 || !(sortedStyleStats[0]?.value > 0) ? (
                        <NoDataPlaceholder className="min-h-[280px]" />
                      ) : (
                        <div className="flex flex-col gap-6 justify-between h-full">
                          <div className="p-4 rounded-2xl bg-accent/5 border border-accent/10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                              <Zap size={40} className="text-accent" />
                            </div>
                            <p className="text-muted text-sm leading-relaxed relative z-10">
                              O nosso modelo de **Machine Learning (K-means)** analisa as tuas viagens em múltiplas dimensões. 
                              Padrões de aceleração brusca e travagens frequentes categorizam o estilo como <span className="text-red font-black">Agressivo</span>, 
                              enquanto a fluidez e consistência indicam um estilo <span className="text-green font-black">Defensivo</span>.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="glass-panel rounded-2xl p-5 border-white/5 relative group hover:border-accent/30 transition-all">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                                  <TrendingUp size={16} />
                                </div>
                                <h4 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted">Tendência Atual</h4>
                              </div>
                              <p className="text-sm font-black text-text tracking-tight leading-tight">
                                {sortedStyleStats[0]?.value > 0 
                                  ? `O teu estilo predominante é ${sortedStyleStats[0].name.toLowerCase()}.` 
                                  : "A aguardar dados suficientes para análise."}
                              </p>
                            </div>
                            <div className="glass-panel rounded-2xl p-5 border-white/5 relative group hover:border-green/30 transition-all">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-green/20 flex items-center justify-center text-green">
                                  <ShieldCheck size={16} />
                                </div>
                                <h4 className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-muted">Recomendação</h4>
                              </div>
                              <p className="text-sm font-black text-text tracking-tight leading-tight">
                                {styleStats.find(s => s.name === "AGGRESSIVE")?.value! > 2 
                                  ? "Recomendamos suavizar as travagens para aumentar a vida útil dos componentes." 
                                  : "Mantém a suavidade nas acelerações para otimizar a eficiência de combustível."}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </Card>
                  </div>
                );
              }

              return null;
            })}

            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AreaChartWrapper({ data, isAnimationActive }: { data: Array<{ t: number; avgSpeed: number }>; isAnimationActive?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
        <XAxis 
          dataKey="t" 
          tickFormatter={(v) => formatShortDay(v as number)}
          tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          dy={15}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "#64748b", fontWeight: 700 }}
        />
        <Tooltip 
          labelFormatter={(v) => formatTs(v as number)}
          contentStyle={{ 
            background: "rgba(13,13,27,0.8)", 
            border: "1px solid rgba(255,255,255,0.1)", 
            borderRadius: "16px", 
            backdropFilter: "blur(20px)", 
            boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
          }}
          itemStyle={{ fontSize: "11px", fontWeight: "900", textTransform: "uppercase" }}
        />
        <Area 
          type="monotone" 
          dataKey="avgSpeed" 
          stroke="#0ea5e9" 
          strokeWidth={4}
          fillOpacity={1}
          fill="url(#colorSpeed)"
          name="Vel. Média" 
          animationDuration={1500}
          isAnimationActive={isAnimationActive}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
