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
  Clock
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

  useEffect(() => {
    document.title = "Analytics — MotoGuard";
  }, []);

  async function load() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await tripsAPI.getFeed(undefined, 500);
      setFeed(res.data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Não foi possível carregar analytics.");
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

  function handleExportCsv() {
    exportCsv(series.filtered, `analytics-${range}.csv`);
  }

  async function handleExportPng() {
    if (!chartsRef.current) return;
    setExporting(true);
    try {
      await exportChartsPng(chartsRef.current, `analytics-${range}.png`);
    } finally {
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
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-text flex items-center gap-3 tracking-tight">
            <BarChart2 className="text-accent" size={28} /> Analytics & Relatórios
          </h1>
          <div className="flex items-center gap-2 text-muted text-sm font-medium">
            <Clock size={14} className="text-accent" />
            {lastUpdatedAt ? `Atualizado: ${formatDateTime(lastUpdatedAt)}` : "—"}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-surface/40 backdrop-blur-md border border-white/10 rounded-2xl p-1 flex gap-1 shadow-xl shadow-black/20">
            <button
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "charts" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text hover:bg-white/5"}`}
              onClick={() => setActiveTab("charts")}
            >
              <BarChart2 size={16} /> Performance
            </button>
            <button
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === "heatmap" ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:text-text hover:bg-white/5"}`}
              onClick={() => setActiveTab("heatmap")}
            >
              <Map size={16} /> Geográfico
            </button>
          </div>

          {activeTab === "charts" && (
            <div className="flex items-center gap-3 bg-surface/40 backdrop-blur-md border border-white/10 rounded-2xl p-1 shadow-xl shadow-black/20">
              <div className="relative group">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-hover:text-accent transition-colors" size={14} />
                <select
                  className="bg-black/20 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-sm text-text font-black focus:border-accent outline-none appearance-none cursor-pointer min-w-[140px]"
                  value={range}
                  onChange={(e) => setRange(e.target.value as PresetRange)}
                >
                  <option value="24h">Hoje (24h)</option>
                  <option value="7d">Semana (7d)</option>
                  <option value="30d">Mês (30d)</option>
                  <option value="365d">Ano (365d)</option>
                  <option value="all">Todo o Histórico</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <select
                className="bg-black/20 border border-white/5 rounded-xl px-4 py-2 text-sm text-text font-black focus:border-accent outline-none appearance-none cursor-pointer w-[100px]"
                value={granularity}
                onChange={(e) => setGranularity(e.target.value as Granularity)}
              >
                <option value="hour">Hora</option>
                <option value="day">Dia</option>
                <option value="week">Semana</option>
              </select>

              <div className="flex items-center gap-1 px-1">
                <button className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-white/5 transition-all" onClick={() => void load()} title="Atualizar">
                  <RefreshCw size={16} />
                </button>
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-white/5 transition-all disabled:opacity-30"
                  onClick={handleExportCsv}
                  disabled={series.filtered.length === 0}
                  title="Exportar CSV"
                >
                  <Download size={16} />
                </button>
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-white/5 transition-all disabled:opacity-30"
                  onClick={() => void handleExportPng()}
                  disabled={exporting || series.points.length === 0}
                  title="Exportar Imagem"
                >
                  {exporting ? <RefreshCw size={16} className="animate-spin" /> : <BarChart2 size={16} />}
                </button>
              </div>
            </div>
          )}
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
                blue: "bg-blue/10 text-blue",
                green: "bg-green/10 text-green",
                orange: "bg-orange/10 text-orange",
                red: "bg-red/10 text-red"
              };
              const isBetter = higher ? curr! >= prev! : curr! <= prev!;
              return (
                <div key={label} className="bg-surface/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-sm group hover:border-white/20 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border border-white/5 shadow-inner ${colorMap[color]}`}>
                      {icon}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className={`text-sm font-black flex items-center gap-1 ${ isBetter ? 'text-green' : 'text-red' }`}>
                        <TrendingUp size={14} className={isBetter ? "" : "rotate-180"} />
                        {pctChange(curr, prev)}
                      </div>
                      <div className="text-[0.65rem] text-muted font-black uppercase tracking-widest mt-0.5">vs anterior</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="text-[0.7rem] font-black uppercase tracking-widest text-muted">{label}</div>
                    <div className="text-3xl font-black text-text tracking-tighter">{fmt(curr)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {series.points.length === 0 ? (
            <div className="bg-surface/40 backdrop-blur-md border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4 mt-8 shadow-xl">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-3xl">📭</div>
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-black text-text m-0">Sem dados para este período</h3>
                <p className="text-muted text-sm font-medium m-0 max-w-xs">Tente ajustar o intervalo temporal ou verifique se existem viagens registadas.</p>
              </div>
            </div>
          ) : (
            <div ref={chartsRef} className="flex flex-col gap-6 mt-8">
              
              {/* Row 1: Activity Hub */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card 
                  title="Resumo de Atividade" 
                  subtitle="Correlação entre volume de viagens e distância percorrida"
                  className="overflow-hidden"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="t" 
                        tickFormatter={(v) => formatShortDay(v as number)} 
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        dx={-10}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        dx={10}
                      />
                      <Tooltip 
                        labelFormatter={(v) => formatTs(v as number)}
                        contentStyle={{ background: "rgba(13,13,13,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                        itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }} />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="distanceKm" 
                        fill="rgba(79, 70, 229, 0.1)" 
                        stroke="#4f46e5" 
                        strokeWidth={3}
                        name="Distância (km)" 
                      />
                      <Bar 
                        yAxisId="right"
                        dataKey="tripCount" 
                        fill="#6366f1" 
                        radius={[4, 4, 0, 0]}
                        name="Nº Viagens" 
                        barSize={20}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Card>

                <Card 
                  title="Perfil de Segurança & Risco" 
                  subtitle="Distribuição de eventos por nível de severidade"
                  className="overflow-hidden"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="t" 
                        tickFormatter={(v) => formatShortDay(v as number)}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        dx={-10}
                      />
                      <Tooltip 
                        labelFormatter={(v) => formatTs(v as number)}
                        contentStyle={{ background: "rgba(13,13,13,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                        itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }} />
                      <Bar dataKey="criticalEvents" fill="#ef4444" name="Crítico" stackId="ev" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="warningEvents" fill="#f59e0b" name="Aviso" stackId="ev" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="infoEvents" fill="#3b82f6" name="Info" stackId="ev" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Row 2: Behavior Trends */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card 
                  title="Tendências de Comportamento" 
                  subtitle="Evolução dos scores de segurança e performance"
                  className="overflow-hidden"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis 
                        dataKey="t" 
                        tickFormatter={(v) => formatShortDay(v as number)}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
                        dx={-10}
                      />
                      <Tooltip 
                        labelFormatter={(v) => formatTs(v as number)}
                        contentStyle={{ background: "rgba(13,13,13,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
                        itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "1px" }} />
                      <Line 
                        type="monotone" 
                        dataKey="safetyAvg" 
                        stroke="#10b981" 
                        strokeWidth={4}
                        dot={{ r: 4, strokeWidth: 2, fill: "#0a0a0a" }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        name="Safety Score" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performanceAvg" 
                        stroke="#8b5cf6" 
                        strokeWidth={4}
                        dot={{ r: 4, strokeWidth: 2, fill: "#0a0a0a" }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        name="Performance" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card 
                  title="Dinâmica de Velocidade" 
                  subtitle="Média de velocidade registada por período"
                  className="overflow-hidden"
                >
                  <AreaChartWrapper data={series.points} />
                </Card>
              </div>

            </div>
          )}
        </>
      )}
    </div>
  );
}

// Sub-component to keep the main component cleaner
function AreaChartWrapper({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data}>
        <defs>
          <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis 
          dataKey="t" 
          tickFormatter={(v) => formatShortDay(v as number)}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
          dy={10}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)", fontWeight: 700 }}
          dx={-10}
        />
        <Tooltip 
          labelFormatter={(v) => formatTs(v as number)}
          contentStyle={{ background: "rgba(13,13,13,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", backdropFilter: "blur(12px)", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}
          itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
        />
        <Area 
          type="monotone" 
          dataKey="avgSpeed" 
          stroke="#0ea5e9" 
          strokeWidth={4}
          fillOpacity={1}
          fill="url(#colorSpeed)"
          name="Vel. Média" 
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
