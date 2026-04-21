// =============================================================================
// MotoGuard IoT — GPX Simulator Page
// =============================================================================
// Parses GPX route files, enriches with motorcycle telemetry, and plays back
// the route with real-time telemetry display and socket emission.
// Mirrors the RealSimulator page but for GPX files instead of CSV+video.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow, ParseResult } from "../real-simulator/csvParser";
import type { GpxStats } from "../gpx-simulator/gpxParser";
import GpxDropzone from "../gpx-simulator/GpxDropzone";
import RouteMap from "../real-simulator/RouteMap";
import { PlaybackControls } from "../real-simulator/PlaybackControls";
import { useSyncEngine } from "../real-simulator/useSyncEngine";
import { buildPayload, emitTelemetry } from "../real-simulator/telemetryEmitter";
import { useAuth } from "../hooks/useAuth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaybackState = "idle" | "playing" | "paused" | "stopped";
type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4;

interface SimulatorSession {
  rows: ParsedRow[];
  deviceId: string;
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentRowIndex: number;
  emittedCount: number;
}

const INITIAL_SESSION: SimulatorSession = {
  rows: [],
  deviceId: "GPX-SIM-001",
  playbackState: "idle",
  playbackSpeed: 1,
  currentRowIndex: 0,
  emittedCount: 0,
};

// ---------------------------------------------------------------------------
// GpxSimulator
// ---------------------------------------------------------------------------

export default function GpxSimulator() {
  const [simSession, setSession] = useState<SimulatorSession>(INITIAL_SESSION);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [gpxStats, setGpxStats] = useState<GpxStats | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const simulationStartTimeRef = useRef<Date>(new Date());

  // Dummy video ref (useSyncEngine requires it but we pass null)
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  useEffect(() => {
    document.title = "Simulador GPX — MotoGuard";
  }, []);

  // Socket lifecycle
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // GPS track for map
  const gpsTrack = simSession.rows.map((r) => ({ lat: r.latitude, lng: r.longitude }));

  const currentPosition =
    simSession.rows.length > 0 && simSession.currentRowIndex < simSession.rows.length
      ? {
          lat: simSession.rows[simSession.currentRowIndex].latitude,
          lng: simSession.rows[simSession.currentRowIndex].longitude,
        }
      : null;

  // Row change handler (emit telemetry)
  const handleRowChange = useCallback((row: ParsedRow, index: number) => {
    setSession((prev) => {
      if (socketRef.current?.connected) {
        const payload = buildPayload(
          row,
          prev.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ACTIVE",
          index
        );
        emitTelemetry(socketRef.current, payload);
      }
      return {
        ...prev,
        currentRowIndex: index,
        emittedCount: prev.emittedCount + 1,
      };
    });
    setCurrentTimeSec(row.timestampSec);
  }, []);

  // Sync engine (no video)
  const syncEngine = useSyncEngine({
    rows: simSession.rows,
    videoRef: null,
    playbackSpeed: simSession.playbackSpeed,
    onRowChange: handleRowChange,
  });

  // Playback controls
  const { user } = useAuth();

  const handlePlay = useCallback(() => {
    if (!socketRef.current?.connected) {
      setSocketError("Socket não conectado. Simulação sem emissão de telemetria.");
    } else {
      setSocketError(null);
      // Registar associação do device com o utilizador atual antes de começar
      if (user?.id) {
        socketRef.current.emit("send_command", {
          acao: "definir_modelo",
          modelo: "GPX Simulator",
          device_id: simSession.deviceId,
          userId: user.id
        });
      }
    }
    simulationStartTimeRef.current = new Date();
    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [syncEngine, user?.id, simSession.deviceId]);

  const handlePause = useCallback(() => {
    syncEngine.pause();
    setSession((prev) => ({ ...prev, playbackState: "paused" }));
  }, [syncEngine]);

  const handleStop = useCallback(() => {
    syncEngine.stop();

    const socket = socketRef.current;
    if (socket?.connected && simSession.rows.length > 0) {
      const lastRow = simSession.rows[simSession.currentRowIndex] ?? simSession.rows[0];
      const payload = buildPayload(
        lastRow,
        simSession.deviceId,
        simulationStartTimeRef.current,
        "TRIP_ENDED",
        simSession.currentRowIndex
      );
      emitTelemetry(socket, payload);
    }

    setCurrentTimeSec(0);
    setSession((prev) => ({
      ...prev,
      playbackState: "stopped",
      currentRowIndex: 0,
      emittedCount: 0,
    }));
  }, [syncEngine, simSession.rows, simSession.currentRowIndex, simSession.deviceId]);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setSession((prev) => ({ ...prev, playbackSpeed: speed }));
  }, []);

  const handleSeek = useCallback(
    (timeSec: number) => {
      syncEngine.seek(timeSec);
      setCurrentTimeSec(timeSec);
    },
    [syncEngine]
  );

  // GPX parsed
  const handleGpxParsed = useCallback((result: ParseResult, stats: GpxStats) => {
    setGpxStats(stats);
    setTotalDurationSec(result.durationSec);
    setCurrentTimeSec(0);
    setSession((prev) => ({
      ...prev,
      rows: result.rows,
      playbackState: "idle",
      currentRowIndex: 0,
      emittedCount: 0,
    }));
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      syncEngine.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived state
  const hasRows = simSession.rows.length > 0;
  const currentRow = hasRows
    ? simSession.rows[Math.min(simSession.currentRowIndex, simSession.rows.length - 1)]
    : null;

  const gpsDataItems = currentRow
    ? [
        { label: "Latitude", value: currentRow.latitude.toFixed(6) },
        { label: "Longitude", value: currentRow.longitude.toFixed(6) },
        { label: "Velocidade", value: `${currentRow.speed_kmh.toFixed(1)} km/h` },
        { label: "Timestamp", value: `${currentRow.timestampSec.toFixed(1)} s` },
        { label: "Pitch (inclinação)", value: `${currentRow.pitch_deg.toFixed(1)}°` },
        { label: "Roll (curva)", value: `${currentRow.roll_deg.toFixed(1)}°` },
        { label: "G-Force", value: currentRow.g_force.toFixed(2) },
        { label: "Yaw (direção)", value: `${currentRow.yaw_deg.toFixed(0)}°` },
      ]
    : [];

  const enrichedDataItems = currentRow
    ? [
        { label: "RPM", value: Math.round(currentRow.rpm).toString() },
        { label: "Mudança", value: currentRow.gear === 0 ? "CVT" : currentRow.gear.toString() },
        { label: "Acelerador", value: `${Math.round(currentRow.throttle_pct)}%` },
        { label: "Temp. Motor", value: `${Math.round(currentRow.engine_temp_c)}°C` },
        { label: "Voltagem", value: `${currentRow.voltage.toFixed(1)} V` },
      ]
    : [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: "20px 24px",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Page title */}
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#f9fafb" }}>
          🗺️ Simulador GPX
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
          Reproduz rotas GPX com telemetria enriquecida de motocicleta
        </p>
      </div>

      {/* GPX file upload */}
      <GpxDropzone onParsed={handleGpxParsed} />

      {/* Socket error */}
      {socketError && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6,
            color: "#fca5a5",
            fontSize: 13,
          }}
        >
          ⚠️ {socketError}
        </div>
      )}

      {/* Telemetry data panels */}
      {hasRows && (
        <div
          className="glass-panel"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 12,
            padding: 12,
          }}
        >
          {/* GPS Data (from GPX file) */}
          <div
            style={{
              padding: "12px 14px",
              border: "1px solid rgba(34,197,94,0.35)",
              borderRadius: 8,
              background: "rgba(34,197,94,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#86efac" }}>
              Dados GPS (ficheiro GPX)
            </h2>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#bbf7d0" }}>
              Valores derivados diretamente do ficheiro GPX (lat, lon, ele, time).
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {gpsDataItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(167,243,208,0.25)",
                    background: "rgba(17,24,39,0.65)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ecfdf5" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Enriched Data (simulator physics) */}
          <div
            style={{
              padding: "12px 14px",
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 8,
              background: "rgba(59,130,246,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#93c5fd" }}>
              Dados Enriquecidos (simulador)
            </h2>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#bfdbfe" }}>
              Telemetria calculada a partir da física de motocicleta e perfil de elevação.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {enrichedDataItems.map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(147,197,253,0.28)",
                    background: "rgba(17,24,39,0.65)",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#eff6ff" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Elevation info */}
            {gpxStats && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(147,197,253,0.18)",
                  background: "rgba(17,24,39,0.45)",
                }}
              >
                <div style={{ fontSize: 11, color: "#9ca3af" }}>Perfil de Elevação</div>
                <div style={{ fontSize: 13, color: "#bfdbfe", marginTop: 2 }}>
                  🏔️ {gpxStats.minElevation}m – {gpxStats.maxElevation}m · 
                  ↗ +{gpxStats.elevationGain}m · ↘ -{gpxStats.elevationLoss}m
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Route Map */}
      <div style={{ flex: 1, minHeight: 380 }}>
        <RouteMap
          gpsTrack={gpsTrack}
          currentPosition={simSession.playbackState === "playing" ? currentPosition : null}
        />
      </div>

      {/* Playback controls */}
      <PlaybackControls
        playbackState={simSession.playbackState}
        playbackSpeed={simSession.playbackSpeed}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        emittedCount={simSession.emittedCount}
        deviceId={simSession.deviceId}
        disabled={!hasRows}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        onSpeedChange={handleSpeedChange}
        onDeviceIdChange={(id) => setSession((prev) => ({ ...prev, deviceId: id }))}
        onSeek={handleSeek}
      />
    </div>
  );
}
