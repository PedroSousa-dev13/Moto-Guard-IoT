import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/ui/Card";
import { useSocket } from "../hooks/useSocket";
import { motorcyclesAPI, tripsAPI } from "../services/api";
import { loadAlerts } from "../utils/alerts";
import type { TripFeedItem } from "../types";

function formatTime(ts: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-PT");
}

export default function Dashboard() {
  const { telemetry, msgCount, status, devices, activeDeviceId, setActiveDeviceId, tripEndedSignal } = useSocket();
  const [motorcycleCount, setMotorcycleCount] = useState<number | null>(null);
  const [feed, setFeed] = useState<TripFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Dashboard — MotoGuard";
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [motosRes, feedRes] = await Promise.all([
        motorcyclesAPI.getAll(),
        tripsAPI.getFeed(undefined, 200),
      ]);
      setMotorcycleCount(motosRes.data.length);
      setFeed(feedRes.data);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Não foi possível carregar o dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Auto-refresh quando uma viagem termina
  useEffect(() => {
    if (tripEndedSignal > 0) void load();
  }, [tripEndedSignal]);

  const alerts = useMemo(() => loadAlerts(), []);
  const unreadAlerts = alerts.filter((a) => a.status === "unread").length;

  const lastUpdate = telemetry?.system?.timestamp
    ? new Date(telemetry.system.timestamp).toISOString()
    : null;

  const tripCount = feed.length;
  const eventCount = feed.reduce((acc, t) => acc + (t.eventCounts?.total ?? 0), 0);

  if (loading) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">A carregar dashboard...</div>
          <div className="empty-state-text">A preparar resumo e atalhos.</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Erro</div>
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
        <div className="header-main">
          <div className="page-title">🏍️ Dashboard</div>
          <div className="page-subtitle">
            Último update: <strong>{formatTime(lastUpdate)}</strong>
          </div>
        </div>
        <div className="page-actions">
          {devices.length > 1 && (
            <select
              className="control control-sm"
              value={activeDeviceId ?? ""}
              onChange={(e) => setActiveDeviceId(e.target.value)}
              style={{ width: 220 }}
            >
              {devices.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <span className={`pill ${status.mqtt ? "pill-success" : "pill-danger"}`}>MQTT</span>
          <span className={`pill ${status.ws ? "pill-success" : "pill-danger"}`}>WS</span>
          <span className={`pill ${status.hasData ? "pill-success" : "pill-warning"}`}>
            {status.hasData ? `#${msgCount}` : "Sem dados"}
          </span>
        </div>
      </div>

      <div className="tile-grid">
        {[
          { label: "Motas", val: motorcycleCount == null ? "—" : String(motorcycleCount) },
          { label: "Viagens (últimas 200)", val: String(tripCount) },
          { label: "Eventos (últimas 200)", val: String(eventCount) },
          { label: "Alertas por ler", val: String(unreadAlerts) },
        ].map(({ label, val }) => (
          <div key={label} className="tile">
            <div className="tile-k">{label}</div>
            <div className="tile-v">{val}</div>
          </div>
        ))}
      </div>

      <div className="tile-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <Card title="Ações rápidas" subtitle="Atalhos">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/simulator-contexts" className="btn btn-primary btn-sm">
              Abrir Simulador
            </Link>
            <Link to="/analytics" className="btn btn-ghost btn-sm">
              Ver Analytics
            </Link>
            <Link to="/alertas" className="btn btn-ghost btn-sm">
              Ver Alertas
            </Link>
            <Link to="/settings" className="btn btn-ghost btn-sm">
              Abrir Settings
            </Link>
          </div>
        </Card>

        <Card title="Estado atual" subtitle="Resumo">
          <div className="info-list">
            <div className="info-row">
              <span className="key">Dispositivo</span>
              <span className="val">{telemetry?.system?.device_id ?? "—"}</span>
            </div>
            <div className="info-row">
              <span className="key">Modelo</span>
              <span className="val">{telemetry?.system?.moto_model ?? "—"}</span>
            </div>
            <div className="info-row">
              <span className="key">Status</span>
              <span className="val">{telemetry?.system?.event_status?.replace(/_/g, " ") ?? "—"}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
