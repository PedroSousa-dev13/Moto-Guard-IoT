import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { tripsAPI } from "../services/api";
import { Trip } from "../types";

type TripSource = Trip["source"];
type TripSourceFilter = "ALL" | TripSource;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
    case "ACTIVE":
      return { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Ativa" };
    case "COMPLETED":
      return {
        bg: "rgba(59,130,246,0.15)",
        color: "#3b82f6",
        label: "Concluída",
      };
    case "CANCELLED":
      return {
        bg: "rgba(239,68,68,0.15)",
        color: "#ef4444",
        label: "Cancelada",
      };
    default:
      return { bg: "rgba(113,113,122,0.15)", color: "#71717a", label: status };
  }
}

function sourceBadge(source: TripSource) {
  switch (source) {
    case "SIMULATOR":
      return { bg: "rgba(14,165,233,0.15)", color: "#0ea5e9", label: "Simulador" };
    case "GPX_IMPORTED":
      return { bg: "rgba(16,185,129,0.15)", color: "#10b981", label: "GPX" };
    case "DEVICE_REAL":
      return { bg: "rgba(244,114,182,0.15)", color: "#f472b6", label: "Dispositivo" };
    default:
      return { bg: "rgba(113,113,122,0.15)", color: "#71717a", label: source };
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "#ef4444";
    case "WARNING":
      return "#eab308";
    default:
      return "#71717a";
  }
}

function eventTypeIcon(type: string) {
  const icons: Record<string, string> = {
    CRASH_DETECTED: "💥",
    EXCESSIVE_LEAN: "↗️",
    HARD_BRAKING: "🛑",
    OVERHEAT: "🌡️",
    LOW_VOLTAGE: "🔋",
    HIGH_VIBRATION: "📳",
    RAPID_ACCELERATION: "🚀",
    TIRE_PRESSURE_LOW: "🛞",
    OIL_PRESSURE_LOW: "🛢️",
  };
  return icons[type] ?? "⚠️";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Trips() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<TripSourceFilter>("ALL");

  useEffect(() => {
    loadTrips();
  }, []);

  // Auto-refresh quando uma viagem começa ou termina
  useEffect(() => {
    const socket = io();
    socket.on("trip_started", () => loadTrips());
    socket.on("trip_ended", () => loadTrips());
    return () => { socket.disconnect(); };
  }, []);

  async function loadTrips() {
    try {
      setIsLoading(true);
      setError(null);
      const res = await tripsAPI.getAll();
      setTrips(res.data);
    } catch {
      setError(
        "Não foi possível carregar as viagens. Verifica a ligação ao servidor.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const filteredTrips =
    sourceFilter === "ALL"
      ? trips
      : trips.filter((trip) => trip.source === sourceFilter);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">A carregar viagens...</div>
          <div className="empty-state-text">Pode demorar alguns segundos.</div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Erro ao carregar viagens</div>
          <div className="empty-state-text" style={{ marginBottom: 14 }}>
            {error}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn btn-primary" onClick={loadTrips}>
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">🛣️ Histórico de Viagens</div>
          <div className="page-subtitle">
            {filteredTrips.length} viagem{filteredTrips.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="page-actions">
          <span className="field-label" style={{ marginTop: 10 }}>
            Origem
          </span>
          <select
            className="control control-sm"
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as TripSourceFilter)}
            style={{ width: 180 }}
          >
            <option value="ALL">Todas</option>
            <option value="SIMULATOR">Simulador</option>
            <option value="GPX_IMPORTED">GPX</option>
            <option value="DEVICE_REAL">Dispositivo</option>
          </select>
        </div>
      </div>

      {/* Empty state */}
      {filteredTrips.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🛣️</div>
          <div className="empty-state-title">Ainda não há viagens registadas</div>
          <div className="empty-state-text">
            {sourceFilter === "ALL"
              ? "As viagens são criadas automaticamente quando o simulador deteta movimento."
              : "Não há viagens para o filtro de origem selecionado."}
          </div>
        </div>
      )}

      {/* Trip list */}
      <div className="trip-list">
        {filteredTrips.map((trip) => {
          const badge = statusBadge(trip.status);
          const tripSourceBadge = sourceBadge(trip.source);
          const isOpen = expandedId === trip.id;
          const evCount =
            trip.events?.length ?? (trip as any)._count?.events ?? 0;

          return (
            <div
              key={trip.id}
              className={`trip-card ${isOpen ? "trip-card-open" : ""}`}
            >
              {/* ── Row ── */}
              <button
                type="button"
                onClick={() => toggle(trip.id)}
                className="trip-row"
              >
                {/* Left: moto + date */}
                <div className="trip-left">
                  <div className="trip-title-row">
                    <span className="trip-title">
                      🏍️ {trip.motorcycle?.name ?? "—"}
                      {trip.motorcycle?.brand
                        ? ` (${trip.motorcycle.brand})`
                        : ""}
                    </span>
                    <span
                      className="badge-pill"
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                    <span
                      className="badge-pill"
                      style={{
                        backgroundColor: tripSourceBadge.bg,
                        color: tripSourceBadge.color,
                      }}
                    >
                      {tripSourceBadge.label}
                    </span>
                    {evCount > 0 && (
                      <span className="trip-warning">
                        ⚠️ {evCount} evento{evCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="trip-date">{formatDate(trip.startedAt)}</span>
                </div>

                {/* Right: stats + chevron */}
                <div className="trip-right">
                  {trip.distanceKm != null && (
                    <Stat
                      value={`${trip.distanceKm.toFixed(1)} km`}
                      label="Distância"
                    />
                  )}
                  {trip.maxSpeedKmh != null && (
                    <Stat
                      value={`${trip.maxSpeedKmh.toFixed(0)} km/h`}
                      label="Vel. Máx."
                      color="var(--accent)"
                    />
                  )}
                  <Stat
                    value={formatDuration(trip.startedAt, trip.endedAt)}
                    label="Duração"
                  />
                  <span
                    className={`trip-chevron ${isOpen ? "trip-chevron-open" : ""}`}
                  >
                    ▾
                  </span>
                </div>
              </button>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div className="trip-details">
                  {/* Stats grid */}
                  <div className="tile-grid" style={{ marginBottom: 16 }}>
                    {[
                      {
                        label: "Distância",
                        val:
                          trip.distanceKm != null
                            ? `${trip.distanceKm.toFixed(2)} km`
                            : trip.status === "ACTIVE" ? "Em direto" : "—",
                      },
                      {
                        label: "Vel. Máxima",
                        val:
                          trip.maxSpeedKmh != null
                            ? `${trip.maxSpeedKmh.toFixed(1)} km/h`
                            : trip.status === "ACTIVE" ? "Em direto" : "—",
                      },
                      {
                        label: "Vel. Média",
                        val:
                          trip.avgSpeedKmh != null
                            ? `${trip.avgSpeedKmh.toFixed(1)} km/h`
                            : trip.status === "ACTIVE" ? "Em direto" : "—",
                      },
                      {
                        label: "Inclin. Máx.",
                        val:
                          trip.maxRollDeg != null
                            ? `${trip.maxRollDeg.toFixed(1)}°`
                            : trip.status === "ACTIVE" ? "Em direto" : "—",
                      },
                      {
                        label: "G-Force Máx.",
                        val:
                          trip.maxGForce != null
                            ? `${trip.maxGForce.toFixed(2)} G`
                            : trip.status === "ACTIVE" ? "Em direto" : "—",
                      },
                      {
                        label: "Duração",
                        val: formatDuration(trip.startedAt, trip.endedAt),
                      },
                    ].map(({ label, val }) => (
                      <div key={label} className="tile">
                        <div className="tile-k">{label}</div>
                        <div className="tile-v">{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Events */}
                  {trip.events && trip.events.length > 0 ? (
                    <div>
                      <div className="trip-events-title">
                        Eventos de Risco ({trip.events.length})
                      </div>
                      <div className="trip-events">
                        {trip.events.map((ev) => (
                          <div
                            key={ev.id}
                            className="trip-event"
                            style={{ borderLeftColor: severityColor(ev.severity) }}
                          >
                            <span className="trip-event-icon">
                              {eventTypeIcon(ev.type)}
                            </span>
                            <span
                              className="trip-event-severity"
                              style={{ color: severityColor(ev.severity) }}
                            >
                              {ev.severity}
                            </span>
                            <span className="trip-event-message">
                              {ev.message}
                            </span>
                            {ev.speedKmh != null && (
                              <span
                                className="trip-event-speed"
                              >
                                {ev.speedKmh.toFixed(0)} km/h
                              </span>
                            )}
                            <span
                              className="trip-event-time"
                            >
                              {new Date(ev.occurredAt).toLocaleTimeString(
                                "pt-PT",
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="trip-events-empty">
                      ✅ Sem eventos de risco nesta viagem
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini stat component ──────────────────────────────────────────────────────
function Stat({
  value,
  label,
  color = "var(--text)",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="mini-stat">
      <div className="mini-stat-value" style={{ color }}>
        {value}
      </div>
      <div className="mini-stat-label">
        {label}
      </div>
    </div>
  );
}
