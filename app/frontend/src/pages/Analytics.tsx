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
} from "recharts";
import { BarChart2, Map } from "lucide-react";
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
          {Array.from({ length: 7 }).map((_, i) => <SkeletonTile key={i} />)}
        </div>
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14, marginTop: 14 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={6} />)}
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
    custom: "Período custom",
  };

  return (
    <div className="page page-full">
      <div className="page-header">
        <div className="header-main">
          <div className="page-title">
            <BarChart2 className="title-icon" size={24} />
            Analytics & Relatórios
          </div>
          <div className="page-subtitle">
            {lastUpdatedAt ? `Atualizado: ${formatDateTime(lastUpdatedAt)}` : "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className={`btn btn-sm${activeTab === "charts" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setActiveTab("charts")}
          >
            <BarChart2 size={14} style={{ marginRight: 4 }} />
            Gráficos
          </button>
          <button
            className={`btn btn-sm${activeTab === "heatmap" ? " btn-primary" : " btn-ghost"}`}
            onClick={() => setActiveTab("heatmap")}
          >
            <Map size={14} style={{ marginRight: 4 }} />
            Heatmap
          </button>
        </div>
        <div className="page-actions" style={{ flexWrap: "wrap" }}>
          {activeTab === "charts" && <>
          <select
            className="control control-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as PresetRange)}
            style={{ width: 190 }}
            aria-label="Intervalo temporal"
          >
            <option value="24h">Hoje (24h)</option>
            <option value="7d">Semana (7 dias)</option>
            <option value="30d">Mês (30 dias)</option>
            <option value="365d">Ano (365 dias)</option>
            <option value="custom">Custom</option>
          </select>
          <select
            className="control control-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            style={{ width: 160 }}
            aria-label="Granularidade temporal"
          >
            <option value="hour">Hora</option>
            <option value="day">Dia</option>
            <option value="week">Semana</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
            Atualizar
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleExportCsv}
            disabled={series.filtered.length === 0}
            aria-label="Exportar dados como CSV"
          >
            CSV
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void handleExportPng()}
            disabled={exporting || series.points.length === 0}
            aria-label="Exportar gráficos como PNG"
          >
            {exporting ? "A exportar..." : "PNG"}
          </button>
          </>}
        </div>
      </div>

      {activeTab === "heatmap" && (
        <Card title="Heatmap de Eventos Críticos" subtitle="Densidade geográfica de eventos por localização">
          <EventHeatmap />
        </Card>
      )}

      {activeTab === "charts" && <>

      {range === "custom" && (
        <Card title="Intervalo customizado">
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

      <div className="tile-grid">
        {[
          { label: "Viagens", val: String(kpis.trips) },
          { label: "Distância", val: `${kpis.distanceKm.toFixed(1)} km` },
          { label: "Eventos", val: String(kpis.events) },
          { label: "CRITICAL", val: String(kpis.criticalEvents) },
          { label: "Vel. média", val: kpis.avgSpeed != null ? `${kpis.avgSpeed.toFixed(0)} km/h` : "—" },
          { label: "Safety", val: kpis.safetyAvg != null ? `${kpis.safetyAvg.toFixed(0)}/100` : "—" },
          { label: "Performance", val: kpis.performanceAvg != null ? `${kpis.performanceAvg.toFixed(0)}/100` : "—" },
        ].map(({ label, val }) => (
          <div key={label} className="tile">
            <div className="tile-k">{label}</div>
            <div className="tile-v">{val}</div>
          </div>
        ))}
      </div>

      {/* Comparativa período vs período anterior */}
      <Card title="Comparativa — período vs período anterior" subtitle={rangeLabel[range]}>
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
          {[
            { label: "Viagens", curr: kpis.trips, prev: prevSeries.trips, fmt: (v: number | null) => v != null ? String(v) : "—", higher: true },
            { label: "Distância (km)", curr: kpis.distanceKm, prev: prevSeries.distanceKm, fmt: (v: number | null) => v != null ? v.toFixed(1) : "—", higher: true },
            { label: "Eventos", curr: kpis.events, prev: prevSeries.events, fmt: (v: number | null) => v != null ? String(v) : "—", higher: false },
            { label: "CRITICAL", curr: kpis.criticalEvents, prev: prevSeries.criticalEvents, fmt: (v: number | null) => v != null ? String(v) : "—", higher: false },
            { label: "Safety", curr: kpis.safetyAvg, prev: prevSeries.safetyAvg, fmt: (v: number | null) => v != null ? v.toFixed(0) : "—", higher: true },
            { label: "Performance", curr: kpis.performanceAvg, prev: prevSeries.performanceAvg, fmt: (v: number | null) => v != null ? v.toFixed(0) : "—", higher: true },
          ].map(({ label, curr, prev, fmt, higher }) => (
            <div key={label} className="tile" style={{ position: "relative" }}>
              <div className="tile-k">{label}</div>
              <div className="tile-v" style={{ fontSize: 20 }}>{fmt(curr)}</div>
              <div style={{ fontSize: 11, marginTop: 2, color: pctColor(curr, prev, higher) }}>
                vs {fmt(prev)} &nbsp;
                <strong>{pctChange(curr, prev)}</strong>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {series.points.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">Sem dados para o intervalo</div>
          <div className="empty-state-text">Ajusta o período ou cria mais viagens.</div>
        </div>
      ) : (
        <div ref={chartsRef} className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 }}>
          <Card title="Distância (km)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="distanceKm" stroke="#4f46e5" dot={false} name="km" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Viagens por período">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Bar dataKey="tripCount" fill="#6366f1" name="Viagens" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Eventos — total">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="events" stroke="#ea580c" dot={false} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Eventos por severidade">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Legend />
                <Bar dataKey="criticalEvents" fill="#ef4444" name="CRITICAL" stackId="ev" />
                <Bar dataKey="warningEvents" fill="#f59e0b" name="WARNING" stackId="ev" />
                <Bar dataKey="infoEvents" fill="#3b82f6" name="INFO" stackId="ev" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Safety Score (média)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="safetyAvg" stroke="#16a34a" dot={false} name="Safety" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Performance Score (média)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="performanceAvg" stroke="#8b5cf6" dot={false} name="Performance" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Velocidade média (km/h)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="avgSpeed" stroke="#0ea5e9" dot={false} name="Vel. média" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
      </>}
    </div>
  );
}
