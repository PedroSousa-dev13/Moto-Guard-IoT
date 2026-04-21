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

function pctColor(curr: number | null, prev: number | null, higherIsBetter = true): string {
  if (prev == null || curr == null || prev === 0) return "var(--muted)";
  const better = higherIsBetter ? curr >= prev : curr <= prev;
  return better ? "#22c55e" : "#ef4444";
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
      <div className="page page-full">
        <div className="page-header">
          <div className="header-main">
            <div className="page-title"><BarChart2 className="title-icon" size={24} />Analytics & Relatórios</div>
          </div>
        </div>
        <div className="tile-grid">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginTop: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} lines={8} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Erro ao carregar analytics</div>
          <div className="empty-state-text" style={{ marginBottom: 14 }}>
            {error}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={() => void load()}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rangeLabel: Record<PresetRange, string> = {
    "24h": "Últimas 24h",
    "7d": "Últimos 7 dias",
    "30d": "Últimos 30 dias",
    "365d": "Último ano",
    all: "Todo o histórico",
    custom: "Período custom",
  };

  return (
    <div className="page page-full">
      <div className="page-header" style={{ marginBottom: 10 }}>
        <div className="header-main">
          <div className="page-title">
            <BarChart2 className="title-icon" size={24} />
            Analytics & Relatórios
          </div>
          <div className="page-subtitle">
            <Clock size={12} />
            {lastUpdatedAt ? `Atualizado: ${formatDateTime(lastUpdatedAt)}` : "—"}
          </div>
        </div>
        
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div className="glass-panel" style={{ padding: "4px", borderRadius: "10px", display: "flex", gap: "2px" }}>
            <button
              className={`btn btn-sm ${activeTab === "charts" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("charts")}
              style={{ border: "none", boxShadow: activeTab === "charts" ? undefined : "none" }}
            >
              <BarChart2 size={14} />
              Performance
            </button>
            <button
              className={`btn btn-sm ${activeTab === "heatmap" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveTab("heatmap")}
              style={{ border: "none", boxShadow: activeTab === "heatmap" ? undefined : "none" }}
            >
              <Map size={14} />
              Geográfico
            </button>
          </div>

          <div className="page-actions">
            {activeTab === "charts" && (
              <>
                <div className="input-with-icon" style={{ minWidth: 160 }}>
                  <Calendar className="input-icon" size={14} />
                  <select
                    className="control control-sm"
                    value={range}
                    onChange={(e) => setRange(e.target.value as PresetRange)}
                    aria-label="Intervalo temporal"
                  >
                    <option value="24h">Hoje (24h)</option>
                    <option value="7d">Semana (7 dias)</option>
                    <option value="30d">Mês (30 dias)</option>
                    <option value="365d">Ano (365 dias)</option>
                    <option value="all">Todo o histórico</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <select
                  className="control control-sm"
                  value={granularity}
                  onChange={(e) => setGranularity(e.target.value as Granularity)}
                  style={{ width: 110 }}
                  aria-label="Granularidade"
                >
                  <option value="hour">Hora</option>
                  <option value="day">Dia</option>
                  <option value="week">Semana</option>
                </select>

                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => void load()} title="Atualizar">
                    <RefreshCw size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleExportCsv}
                    disabled={series.filtered.length === 0}
                    title="Exportar CSV"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void handleExportPng()}
                    disabled={exporting || series.points.length === 0}
                    title="Exportar Imagem"
                  >
                    {exporting ? "..." : <BarChart2 size={14} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {activeTab === "heatmap" && (
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Mapa de Calor de Eventos</h3>
            <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Distribuição geográfica de incidentes críticos detetados.</p>
          </div>
          <EventHeatmap />
        </div>
      )}

      {activeTab === "charts" && (
        <>
          {range === "custom" && (
            <Card title="Intervalo Customizado">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="analytics-from">De</label>
                  <input
                    id="analytics-from"
                    className="control"
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="analytics-to">Até</label>
                  <input
                    id="analytics-to"
                    className="control"
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* KPI Dashboard */}
          <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {[
              { 
                label: "Distância Total", 
                curr: kpis.distanceKm, 
                prev: prevSeries.distanceKm, 
                fmt: (v: number | null) => v != null ? `${v.toFixed(1)} km` : "—", 
                higher: true,
                icon: <Navigation size={20} />,
                color: "blue"
              },
              { 
                label: "Safety Score", 
                curr: kpis.safetyAvg, 
                prev: prevSeries.safetyAvg, 
                fmt: (v: number | null) => v != null ? `${v.toFixed(0)}/100` : "—", 
                higher: true,
                icon: <ShieldCheck size={20} />,
                color: "green"
              },
              { 
                label: "Performance", 
                curr: kpis.performanceAvg, 
                prev: prevSeries.performanceAvg, 
                fmt: (v: number | null) => v != null ? `${v.toFixed(0)}/100` : "—", 
                higher: true,
                icon: <Zap size={20} />,
                color: "orange"
              },
              { 
                label: "Incidentes Críticos", 
                curr: kpis.criticalEvents, 
                prev: prevSeries.criticalEvents, 
                fmt: (v: number | null) => v != null ? String(v) : "—", 
                higher: false,
                icon: <AlertTriangle size={20} />,
                color: "red"
              },
            ].map(({ label, curr, prev, fmt, higher, icon, color }) => (
              <div key={label} className="tile" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div className={`tile-icon tile-icon-${color}`}>{icon}</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.8rem", color: pctColor(curr, prev, higher), fontWeight: 700, display: "flex", alignItems: "center", gap: "2px", justifyContent: "flex-end" }}>
                      <TrendingUp size={12} style={{ transform: (higher ? curr! >= prev! : curr! <= prev!) ? "none" : "rotate(180deg)" }} />
                      {pctChange(curr, prev)}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>vs anterior</div>
                  </div>
                </div>
                <div className="tile-k">{label}</div>
                <div className="tile-v" style={{ fontSize: "2.2rem", marginTop: "4px" }}>{fmt(curr)}</div>
              </div>
            ))}
          </div>

          {series.points.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 20 }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-title">Sem dados para o intervalo selecionado</div>
              <div className="empty-state-text">Tente ajustar o período ou verifique se existem viagens registadas.</div>
            </div>
          ) : (
            <div ref={chartsRef} style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
              
              {/* Row 1: Activity Hub */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" }}>
                <Card 
                  title="Resumo de Atividade" 
                  subtitle="Correlação entre volume de viagens e distância percorrida"
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="t" 
                        tickFormatter={(v) => formatShortDay(v as number)} 
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        yAxisId="left"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11 }}
                        label={{ value: 'km', angle: -90, position: 'insideLeft', fontSize: 10, fill: "var(--muted)" }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11 }}
                        label={{ value: 'viagens', angle: 90, position: 'insideRight', fontSize: 10, fill: "var(--muted)" }}
                      />
                      <Tooltip 
                        labelFormatter={(v) => formatTs(v as number)}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      <Area 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="distanceKm" 
                        fill="rgba(79, 70, 229, 0.1)" 
                        stroke="#4f46e5" 
                        strokeWidth={2}
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
                >
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="t" 
                        tickFormatter={(v) => formatShortDay(v as number)}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        labelFormatter={(v) => formatTs(v as number)}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      <Bar dataKey="criticalEvents" fill="#ef4444" name="Crítico" stackId="ev" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="warningEvents" fill="#f59e0b" name="Aviso" stackId="ev" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="infoEvents" fill="#3b82f6" name="Info" stackId="ev" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Row 2: Behavior Trends */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" }}>
                <Card 
                  title="Tendências de Comportamento" 
                  subtitle="Evolução dos scores de segurança e performance"
                >
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={series.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                      <XAxis 
                        dataKey="t" 
                        tickFormatter={(v) => formatShortDay(v as number)}
                        tick={{ fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip 
                        labelFormatter={(v) => formatTs(v as number)}
                        contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
                      />
                      <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                      <Line 
                        type="monotone" 
                        dataKey="safetyAvg" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
                        activeDot={{ r: 6 }}
                        name="Safety Score" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="performanceAvg" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2, fill: "var(--surface)" }}
                        activeDot={{ r: 6 }}
                        name="Performance" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card 
                  title="Dinâmica de Velocidade" 
                  subtitle="Média de velocidade registada por período"
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
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
        <XAxis 
          dataKey="t" 
          tickFormatter={(v) => formatShortDay(v as number)}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11 }}
          label={{ value: 'km/h', angle: -90, position: 'insideLeft', fontSize: 10, fill: "var(--muted)" }}
        />
        <Tooltip 
          labelFormatter={(v) => formatTs(v as number)}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px" }}
        />
        <Area 
          type="monotone" 
          dataKey="avgSpeed" 
          stroke="#0ea5e9" 
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorSpeed)"
          name="Vel. Média" 
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
