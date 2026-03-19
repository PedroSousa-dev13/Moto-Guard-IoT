import React, { useEffect, useMemo, useState } from "react";
import { tripsAPI } from "../services/api";
import type { TripFeedItem } from "../types";
import Card from "../components/ui/Card";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { aggregateFeedSeries, type Granularity, type PresetRange } from "../utils/analytics";

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

export default function Analytics() {
  const [range, setRange] = useState<PresetRange>("7d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [feed, setFeed] = useState<TripFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Analytics — MotoGuard";
  }, []);

  async function load() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await tripsAPI.getFeed(undefined, 200);
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

  const kpis = useMemo(() => {
    const items = series.filtered;
    const trips = items.length;
    const distanceKm = items.reduce((acc, t) => acc + (t.distanceKm ?? 0), 0);
    const events = items.reduce((acc, t) => acc + (t.eventCounts?.total ?? 0), 0);
    const avgSpeed = (() => {
      const xs = items.map((t) => t.avgSpeedKmh).filter((v): v is number => typeof v === "number");
      if (xs.length === 0) return null;
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    })();
    const safetyAvg = (() => {
      const xs = items.map((t) => t.safetyScore).filter((v) => typeof v === "number");
      if (xs.length === 0) return null;
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    })();

    return {
      trips,
      distanceKm,
      events,
      avgSpeed,
      safetyAvg,
    };
  }, [series.filtered]);

  if (isLoading) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">A carregar analytics...</div>
          <div className="empty-state-text">A preparar gráficos e métricas.</div>
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

  return (
    <div className="page page-full">
      <div className="page-header">
        <div>
          <div className="page-title">📊 Analytics</div>
          <div className="page-subtitle">
            {lastUpdatedAt ? `Atualizado: ${formatDateTime(lastUpdatedAt)}` : "—"}
          </div>
        </div>
        <div className="page-actions" style={{ flexWrap: "wrap" }}>
          <select
            className="control control-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as PresetRange)}
            style={{ width: 190 }}
          >
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="custom">Custom</option>
          </select>
          <select
            className="control control-sm"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            style={{ width: 160 }}
          >
            <option value="hour">Hora</option>
            <option value="day">Dia</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
            Atualizar
          </button>
        </div>
      </div>

      {range === "custom" && (
        <Card title="Intervalo customizado">
          <div className="form-grid">
            <div className="field">
              <div className="field-label">De</div>
              <input
                className="control"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="field">
              <div className="field-label">Até</div>
              <input
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
          {
            label: "Vel. média",
            val: kpis.avgSpeed != null ? `${kpis.avgSpeed.toFixed(0)} km/h` : "—",
          },
          {
            label: "Safety",
            val: kpis.safetyAvg != null ? `${kpis.safetyAvg.toFixed(0)}/100` : "—",
          },
        ].map(({ label, val }) => (
          <div key={label} className="tile">
            <div className="tile-k">{label}</div>
            <div className="tile-v">{val}</div>
          </div>
        ))}
      </div>

      {series.points.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <div className="empty-state-title">Sem dados para o intervalo</div>
          <div className="empty-state-text">Ajusta o período ou cria mais viagens.</div>
        </div>
      ) : (
        <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 14 }}>
          <Card title="Distância (km)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="distanceKm" stroke="#4f46e5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Eventos (total)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="events" stroke="#ea580c" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Safety (média)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="safetyAvg" stroke="#16a34a" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Velocidade média (km/h)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series.points}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="t" tickFormatter={(v) => formatShortDay(v as number)} />
                <YAxis />
                <Tooltip labelFormatter={(v) => formatTs(v as number)} />
                <Line type="monotone" dataKey="avgSpeed" stroke="#0ea5e9" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
