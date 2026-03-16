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
      <div style={{ padding: "3rem", textAlign: "center", color: "#71717a" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
        <p>A carregar viagens...</p>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⚠️</div>
        <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>
        <button
          onClick={loadTrips}
          style={{
            padding: "0.6rem 1.5rem",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "1.5rem", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          🛣️ Histórico de Viagens
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>Origem</label>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as TripSourceFilter)}
            style={{
              backgroundColor: "#171923",
              color: "#e4e4e7",
              border: "1px solid #2a2d3a",
              borderRadius: "8px",
              padding: "6px 8px",
              fontSize: "0.8rem",
            }}
          >
            <option value="ALL">Todas</option>
            <option value="SIMULATOR">Simulador</option>
            <option value="GPX_IMPORTED">GPX</option>
            <option value="DEVICE_REAL">Dispositivo</option>
          </select>
          <span style={{ color: "#71717a", fontSize: "0.875rem" }}>
            {filteredTrips.length} viagem{filteredTrips.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Empty state */}
      {filteredTrips.length === 0 && (
        <div
          style={{
            backgroundColor: "#1a1d27",
            border: "1px solid #2a2d3a",
            borderRadius: "12px",
            padding: "4rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🛣️</div>
          <h2
            style={{
              color: "#71717a",
              fontWeight: 400,
              marginBottom: "0.5rem",
            }}
          >
            Ainda não há viagens registadas
          </h2>
          <p style={{ color: "#52525b", fontSize: "0.875rem" }}>
            {sourceFilter === "ALL"
              ? "As viagens são criadas automaticamente quando o simulador deteta movimento."
              : "Não há viagens para o filtro de origem selecionado."}
          </p>
        </div>
      )}

      {/* Trip list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filteredTrips.map((trip) => {
          const badge = statusBadge(trip.status);
          const tripSourceBadge = sourceBadge(trip.source);
          const isOpen = expandedId === trip.id;
          const evCount =
            trip.events?.length ?? (trip as any)._count?.events ?? 0;

          return (
            <div
              key={trip.id}
              style={{
                backgroundColor: "#1a1d27",
                border: `1px solid ${isOpen ? "#3b82f6" : "#2a2d3a"}`,
                borderRadius: "12px",
                overflow: "hidden",
                transition: "border-color 0.2s",
              }}
            >
              {/* ── Row ── */}
              <div
                onClick={() => toggle(trip.id)}
                style={{
                  padding: "14px 20px",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                {/* Left: moto + date */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                      🏍️ {trip.motorcycle?.name ?? "—"}
                      {trip.motorcycle?.brand
                        ? ` (${trip.motorcycle.brand})`
                        : ""}
                    </span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "20px",
                        backgroundColor: badge.bg,
                        color: badge.color,
                      }}
                    >
                      {badge.label}
                    </span>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "20px",
                        backgroundColor: tripSourceBadge.bg,
                        color: tripSourceBadge.color,
                      }}
                    >
                      {tripSourceBadge.label}
                    </span>
                    {evCount > 0 && (
                      <span style={{ fontSize: "0.75rem", color: "#f97316" }}>
                        ⚠️ {evCount} evento{evCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "0.78rem", color: "#71717a" }}>
                    {formatDate(trip.startedAt)}
                  </span>
                </div>

                {/* Right: stats + chevron */}
                <div
                  style={{ display: "flex", gap: "24px", alignItems: "center" }}
                >
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
                      color="#3b82f6"
                    />
                  )}
                  <Stat
                    value={formatDuration(trip.startedAt, trip.endedAt)}
                    label="Duração"
                  />
                  <span
                    style={{
                      color: "#71717a",
                      fontSize: "1rem",
                      display: "inline-block",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  >
                    ▾
                  </span>
                </div>
              </div>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div
                  style={{
                    borderTop: "1px solid #2a2d3a",
                    padding: "16px 20px",
                    backgroundColor: "rgba(0,0,0,0.18)",
                  }}
                >
                  {/* Stats grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(130px, 1fr))",
                      gap: "10px",
                      marginBottom: "16px",
                    }}
                  >
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
                      <div
                        key={label}
                        style={{
                          backgroundColor: "#1a1d27",
                          border: "1px solid #2a2d3a",
                          borderRadius: "8px",
                          padding: "10px 12px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.68rem",
                            color: "#71717a",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: "4px",
                          }}
                        >
                          {label}
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Events */}
                  {trip.events && trip.events.length > 0 ? (
                    <div>
                      <h3
                        style={{
                          fontSize: "0.72rem",
                          color: "#71717a",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          marginBottom: "8px",
                        }}
                      >
                        Eventos de Risco ({trip.events.length})
                      </h3>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                        }}
                      >
                        {trip.events.map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "8px 12px",
                              backgroundColor: "#0f1117",
                              borderRadius: "6px",
                              borderLeft: `3px solid ${severityColor(ev.severity)}`,
                            }}
                          >
                            <span style={{ fontSize: "1rem" }}>
                              {eventTypeIcon(ev.type)}
                            </span>
                            <span
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                color: severityColor(ev.severity),
                                minWidth: "58px",
                              }}
                            >
                              {ev.severity}
                            </span>
                            <span style={{ fontSize: "0.85rem", flex: 1 }}>
                              {ev.message}
                            </span>
                            {ev.speedKmh != null && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#3b82f6",
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {ev.speedKmh.toFixed(0)} km/h
                              </span>
                            )}
                            <span
                              style={{ fontSize: "0.72rem", color: "#71717a" }}
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
                    <p
                      style={{
                        color: "#52525b",
                        fontSize: "0.875rem",
                        textAlign: "center",
                        padding: "0.5rem 0",
                      }}
                    >
                      ✅ Sem eventos de risco nesta viagem
                    </p>
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
  color = "#e4e4e7",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color,
          fontSize: "0.9rem",
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "0.68rem", color: "#71717a", marginTop: "2px" }}>
        {label}
      </div>
    </div>
  );
}
