import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import { tripsAPI } from "../services/api";
import { loadAlerts } from "../utils/alerts";
import {
  Gauge, Zap, Disc, ArrowUpCircle,
  MoveHorizontal, Activity,
  Wifi, WifiOff, Radio, AlertTriangle,
  MapPin, Clock, Route, ChevronRight,
  Cpu, Bell
} from "lucide-react";
import type { TripFeedItem } from "../types";
import "./Dashboard.css";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | undefined | null, decimals = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

function fmtTime(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(ts: string | null | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" }) + " " +
    d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function speedColor(v: number) {
  if (v > 160) return "var(--red)";
  if (v > 100) return "var(--yellow)";
  return "var(--green)";
}

function rollColor(v: number) {
  const a = Math.abs(v);
  if (a > 45) return "var(--red)";
  if (a > 30) return "var(--yellow)";
  return "var(--text)";
}

function gColor(v: number) {
  if (v > 2) return "var(--red)";
  if (v > 1.5) return "var(--yellow)";
  return "var(--text)";
}

function scoreColor(s: number) {
  if (s >= 80) return "var(--green)";
  if (s >= 50) return "var(--yellow)";
  return "var(--red)";
}

// ── sub-components ────────────────────────────────────────────────────────────

function LiveDot({ active }: { active: boolean }) {
  return (
    <span className={`live-dot ${active ? "live-dot-on" : "live-dot-off"}`} />
  );
}

function StatChip({
  icon, label, value, unit, color,
}: {
  icon: React.ReactNode; label: string; value: string; unit?: string; color?: string;
}) {
  return (
    <div className="db-stat-chip">
      <div className="db-stat-chip-icon">{icon}</div>
      <div className="db-stat-chip-body">
        <span className="db-stat-chip-label">{label}</span>
        <span className="db-stat-chip-value" style={color ? { color } : undefined}>
          {value}
          {unit && <span className="db-stat-chip-unit">{unit}</span>}
        </span>
      </div>
    </div>
  );
}

function GaugeBlock({
  icon, value, unit, label, color,
}: {
  icon: React.ReactNode; value: string; unit: string; label: string; color?: string;
}) {
  return (
    <div className="db-gauge">
      <div className="db-gauge-icon">{icon}</div>
      <div className="db-gauge-value" style={color ? { color } : undefined}>{value}</div>
      <div className="db-gauge-unit">{unit}</div>
      <div className="db-gauge-label">{label}</div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { telemetry, msgCount, status, devices, activeDeviceId, setActiveDeviceId, tripEndedSignal } = useSocket();
  const [lastTrip, setLastTrip] = useState<TripFeedItem | null>(null);

  useEffect(() => { document.title = "Dashboard — MotoGuard"; }, []);

  useEffect(() => {
    tripsAPI.getFeed(undefined, 1)
      .then((r) => setLastTrip(r.data[0] ?? null))
      .catch(() => {});
  }, [tripEndedSignal]);

  const alerts = useMemo(() => loadAlerts(), [tripEndedSignal]);
  const recentAlerts = alerts.slice(0, 3);
  const unreadCount = alerts.filter((a) => a.status === "unread").length;

  const tel = telemetry?.telemetry;
  const imu = telemetry?.imu;
  const sys = telemetry?.system;
  const hasData = status.hasData && !!tel;

  const lastUpdate = sys?.timestamp ? new Date(sys.timestamp).toISOString() : null;

  return (
    <div className="db-page">

      {/* ── HEADER ── */}
      <div className="db-header">
        <div className="db-header-left">
          <div className="db-header-title">Dashboard</div>
          <div className="db-header-meta">
            {hasData ? (
              <>
                <LiveDot active />
                <span>Live · {sys?.moto_model ?? "—"} · {sys?.device_id ?? "—"}</span>
                <span className="db-header-sep">·</span>
                <span>Último update: {fmtTime(lastUpdate)}</span>
              </>
            ) : (
              <>
                <LiveDot active={false} />
                <span>Sem dados ao vivo</span>
              </>
            )}
          </div>
        </div>

        <div className="db-header-right">
          {devices.length > 1 && (
            <select
              className="control control-sm"
              value={activeDeviceId ?? ""}
              onChange={(e) => setActiveDeviceId(e.target.value)}
              style={{ width: 200 }}
            >
              {devices.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}
          <div className={`db-conn-badge ${status.mqtt ? "db-conn-ok" : "db-conn-off"}`}>
            {status.mqtt ? <Radio size={13} /> : <WifiOff size={13} />}
            MQTT
          </div>
          <div className={`db-conn-badge ${status.ws ? "db-conn-ok" : "db-conn-off"}`}>
            {status.ws ? <Wifi size={13} /> : <WifiOff size={13} />}
            WS
          </div>
          {hasData && (
            <div className="db-conn-badge db-conn-ok">
              <Activity size={13} />
              #{msgCount}
            </div>
          )}
        </div>
      </div>

      {/* ── LIVE STAT CHIPS ── */}
      <div className="db-chips">
        <StatChip icon={<Gauge size={16} />} label="Velocidade"
          value={fmt(tel?.speed_kmh)} unit=" km/h"
          color={hasData ? speedColor(tel?.speed_kmh ?? 0) : undefined} />
        <StatChip icon={<Zap size={16} />} label="RPM"
          value={fmt(tel?.rpm)} unit=" rpm" />
        <StatChip icon={<MoveHorizontal size={16} />} label="Roll"
          value={fmt(imu?.roll_deg, 1)} unit="°"
          color={hasData ? rollColor(imu?.roll_deg ?? 0) : undefined} />
        <StatChip icon={<Activity size={16} />} label="G-Force"
          value={fmt(imu?.g_force, 2)} unit=" G"
          color={hasData ? gColor(imu?.g_force ?? 0) : undefined} />
        <StatChip icon={<Disc size={16} />} label="Mudança"
          value={tel?.gear === 0 ? "N" : fmt(tel?.gear)} />
        <StatChip icon={<ArrowUpCircle size={16} />} label="Acelerador"
          value={fmt(tel?.throttle_pct)} unit="%" />
      </div>

      {/* ── MAIN GRID ── */}
      <div className="db-main-grid">

        {/* LEFT: Gauges */}
        <div className="db-gauges-col">
          <div className="db-section-label">Motor & Velocidade</div>
          <div className="db-gauge-grid">
            <GaugeBlock icon={<Gauge size={14} />} label="Velocidade"
              value={fmt(tel?.speed_kmh)} unit="km/h"
              color={hasData ? speedColor(tel?.speed_kmh ?? 0) : undefined} />
            <GaugeBlock icon={<Zap size={14} />} label="RPM"
              value={fmt(tel?.rpm)} unit="rpm" />
            <GaugeBlock icon={<Disc size={14} />} label="Mudança"
              value={tel?.gear === 0 ? "N" : fmt(tel?.gear)} unit="" />
            <GaugeBlock icon={<ArrowUpCircle size={14} />} label="Acelerador"
              value={fmt(tel?.throttle_pct)} unit="%" />
          </div>

          <div className="db-section-label" style={{ marginTop: 20 }}>IMU — Inércia</div>
          <div className="db-gauge-grid">
            <GaugeBlock icon={<MoveHorizontal size={14} />} label="Roll"
              value={fmt(imu?.roll_deg, 1)} unit="°"
              color={hasData ? rollColor(imu?.roll_deg ?? 0) : undefined} />
            <GaugeBlock icon={<MoveHorizontal size={14} />} label="Pitch"
              value={fmt(imu?.pitch_deg, 1)} unit="°" />
            <GaugeBlock icon={<MoveHorizontal size={14} />} label="Yaw"
              value={fmt(imu?.yaw_deg, 1)} unit="°" />
            <GaugeBlock icon={<Activity size={14} />} label="G-Force"
              value={fmt(imu?.g_force, 2)} unit="G"
              color={hasData ? gColor(imu?.g_force ?? 0) : undefined} />
          </div>

          {/* Status do dispositivo */}
          {hasData && (
            <div className="db-device-status">
              <div className="db-section-label" style={{ marginBottom: 10 }}>Dispositivo</div>
              <div className="db-device-rows">
                <div className="db-device-row">
                  <span>ID</span>
                  <span className="db-device-val mono">{sys?.device_id ?? "—"}</span>
                </div>
                <div className="db-device-row">
                  <span>Modelo</span>
                  <span className="db-device-val">{sys?.moto_model ?? "—"}</span>
                </div>
                <div className="db-device-row">
                  <span>Status</span>
                  <span className="db-device-val">{sys?.event_status?.replace(/_/g, " ") ?? "—"}</span>
                </div>
                <div className="db-device-row">
                  <span>Odómetro</span>
                  <span className="db-device-val">{fmt(tel?.odometer_km, 2)} km</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Last trip + Alerts */}
        <div className="db-right-col">

          {/* Última viagem */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">Última Viagem</span>
              <Link to="/trips" className="db-card-link">
                Ver todas <ChevronRight size={14} />
              </Link>
            </div>
            <div className="db-card-body">
              {lastTrip ? (
                <div className="db-trip">
                  <div className="db-trip-top">
                    <span className="db-trip-moto">{lastTrip.motorcycle?.name ?? "—"}</span>
                    <span className={`db-trip-score`} style={{ color: scoreColor(lastTrip.safetyScore) }}>
                      {lastTrip.safetyScore}
                      <span className="db-trip-score-label">score</span>
                    </span>
                  </div>
                  <div className="db-trip-meta">
                    <span><Clock size={12} /> {fmtDate(lastTrip.startedAt)}</span>
                    <span><Route size={12} /> {fmt(lastTrip.distanceKm ?? 0, 1)} km</span>
                    <span><Gauge size={12} /> {fmt(lastTrip.maxSpeedKmh ?? 0)} km/h max</span>
                  </div>
                  {lastTrip.eventCounts.total > 0 && (
                    <div className="db-trip-events">
                      {lastTrip.eventCounts.bySeverity.CRITICAL > 0 && (
                        <span className="db-trip-ev db-trip-ev-critical">
                          {lastTrip.eventCounts.bySeverity.CRITICAL} crítico{lastTrip.eventCounts.bySeverity.CRITICAL > 1 ? "s" : ""}
                        </span>
                      )}
                      {lastTrip.eventCounts.bySeverity.WARNING > 0 && (
                        <span className="db-trip-ev db-trip-ev-warning">
                          {lastTrip.eventCounts.bySeverity.WARNING} aviso{lastTrip.eventCounts.bySeverity.WARNING > 1 ? "s" : ""}
                        </span>
                      )}
                      {lastTrip.eventCounts.bySeverity.INFO > 0 && (
                        <span className="db-trip-ev db-trip-ev-info">
                          {lastTrip.eventCounts.bySeverity.INFO} info
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="db-empty">
                  <Route size={28} />
                  <span>Nenhuma viagem registada</span>
                  <Link to="/simulator-contexts" className="btn btn-sm btn-primary">
                    <Cpu size={14} /> Abrir Simulador
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Alertas recentes */}
          <div className="db-card">
            <div className="db-card-header">
              <span className="db-card-title">
                Alertas Recentes
                {unreadCount > 0 && (
                  <span className="db-alert-badge">{unreadCount}</span>
                )}
              </span>
              <Link to="/alertas" className="db-card-link">
                Ver todos <ChevronRight size={14} />
              </Link>
            </div>
            <div className="db-card-body">
              {recentAlerts.length > 0 ? (
                <div className="db-alerts-list">
                  {recentAlerts.map((a) => (
                    <div key={a.id} className={`db-alert-row db-alert-${a.severity.toLowerCase()}`}>
                      <AlertTriangle size={14} className="db-alert-icon" />
                      <div className="db-alert-content">
                        <span className="db-alert-title">{a.title}</span>
                        <span className="db-alert-time">{fmtTime(a.timestamp)}</span>
                      </div>
                      {a.status === "unread" && <span className="db-alert-dot" />}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="db-empty">
                  <Bell size={28} />
                  <span>Sem alertas recentes</span>
                </div>
              )}
            </div>
          </div>

          {/* Empty state quando não há dados ao vivo */}
          {!hasData && (
            <div className="db-card db-no-data-card">
              <div className="db-card-body">
                <div className="db-empty db-empty-lg">
                  <div className="db-empty-icon-wrap">
                    <MapPin size={32} />
                  </div>
                  <span className="db-empty-title">Sem telemetria ao vivo</span>
                  <span className="db-empty-sub">Liga o simulador ou um dispositivo real para ver dados em tempo real.</span>
                  <Link to="/simulator-contexts" className="btn btn-primary btn-sm">
                    <Cpu size={14} /> Abrir Simulador
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
