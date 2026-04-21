// =============================================================================
// MotoGuard IoT — Real Simulator Page
// =============================================================================
// Orquestra CsvDropzone, RouteMap, VideoPlayer, PlaybackControls e useSyncEngine
// para reproduzir ficheiros CSV de telemetria sincronizados com vídeo .mp4.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow } from "../real-simulator/csvParser";
import type { ParseResult } from "../real-simulator/csvParser";
import CsvDropzone from "../real-simulator/CsvDropzone";
import RouteMap from "../real-simulator/RouteMap";
import VideoPlayer from "../real-simulator/VideoPlayer";
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
  videoFile: File | null;
  playbackState: PlaybackState;
  playbackSpeed: PlaybackSpeed;
  currentRowIndex: number;
  emittedCount: number;
}

const INITIAL_SESSION: SimulatorSession = {
  rows: [],
  deviceId: "REAL-SIM-001",
  videoFile: null,
  playbackState: "idle",
  playbackSpeed: 1,
  currentRowIndex: 0,
  emittedCount: 0,
};

// ---------------------------------------------------------------------------
// RealSimulator
// ---------------------------------------------------------------------------

export default function RealSimulator() {
  const [simSession, setSession] = useState<SimulatorSession>(INITIAL_SESSION);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [sourceFormat, setSourceFormat] = useState<ParseResult["format"] | null>(null);
  const [totalDurationSec, setTotalDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);

  // Socket for emitting telemetry
  const socketRef = useRef<Socket | null>(null);

  // Video element ref (passed to VideoPlayer and useSyncEngine)
  // Cast needed: React 19 useRef returns RefObject<T | null>, but components expect RefObject<T>
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  // simulationStartTime is set when Play is first clicked
  const simulationStartTimeRef = useRef<Date>(new Date());

  // Set document title on mount
  useEffect(() => {
    document.title = "Simulador Real — MotoGuard";
  }, []);

  // Create socket on mount, clean up on unmount
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // GPS track derived from rows
  // ---------------------------------------------------------------------------

  const gpsTrack = simSession.rows.map((r) => ({ lat: r.latitude, lng: r.longitude }));

  const currentPosition =
    simSession.rows.length > 0 && simSession.currentRowIndex < simSession.rows.length
      ? {
          lat: simSession.rows[simSession.currentRowIndex].latitude,
          lng: simSession.rows[simSession.currentRowIndex].longitude,
        }
      : null;

  // ---------------------------------------------------------------------------
  // onRowChange: called by useSyncEngine on each row advance
  // ---------------------------------------------------------------------------

  const handleRowChange = useCallback(
    (row: ParsedRow, index: number) => {
      setSession((prev) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return { ...prev, currentRowIndex: index };
        }

        const payload = buildPayload(
          row,
          prev.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ACTIVE",
          index
        );
        emitTelemetry(socketRef.current, payload);

        return {
          ...prev,
          currentRowIndex: index,
          emittedCount: prev.emittedCount + 1,
        };
      });

      // Update current time display
      setCurrentTimeSec(row.timestampSec);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // useSyncEngine
  // ---------------------------------------------------------------------------
  const syncEngine = useSyncEngine({
    rows: simSession.rows,
    videoRef: simSession.videoFile ? videoRef : null,
    playbackSpeed: simSession.playbackSpeed,
    onRowChange: handleRowChange,
    onEnd: () => {
      // Natural end
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      const socket = socketRef.current;
      if (socket?.connected && simSession.rows.length > 0) {
        const lastRow = simSession.rows[simSession.rows.length - 1];
        const payload = buildPayload(
          lastRow,
          simSession.deviceId,
          simulationStartTimeRef.current,
          "TRIP_ENDED",
          simSession.rows.length - 1
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
    }
  });

  // ---------------------------------------------------------------------------
  // Playback handlers
  // ---------------------------------------------------------------------------
  const { user } = useAuth();

  const handlePause = useCallback(() => {
    if (simSession.videoFile && videoRef.current) {
      videoRef.current.pause();
    }
    syncEngine.pause();
    setSession((prev) => ({ ...prev, playbackState: "paused" }));
  }, [simSession.videoFile, syncEngine]);

  const handleStop = useCallback(() => {
    // Stop sync engine
    syncEngine.stop();

    // Stop and reset video
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }

    // Emit TRIP_ENDED payload
    const socket = socketRef.current;
    if (socket && socket.connected && simSession.rows.length > 0) {
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

  const handlePlay = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setSocketError(
        "Socket não conectado. A simulação local vai iniciar sem emissão de telemetria."
      );
    } else {
      setSocketError(null);
      // Registar associação do device com o utilizador atual
      if (user?.id) {
        socket.emit("send_command", {
          acao: "definir_modelo",
          modelo: "Real Simulator",
          device_id: simSession.deviceId,
          userId: user.id
        });
      }
    }
    simulationStartTimeRef.current = new Date();

    // Start video if available
    if (simSession.videoFile && videoRef.current) {
      videoRef.current.playbackRate = simSession.playbackSpeed;
      videoRef.current.play().catch(() => {});
    }

    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [simSession.videoFile, simSession.playbackSpeed, syncEngine, user?.id, simSession.deviceId]);

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      if (simSession.videoFile && videoRef.current) {
        videoRef.current.playbackRate = speed;
      }
      setSession((prev) => ({ ...prev, playbackSpeed: speed }));
    },
    [simSession.videoFile]
  );

  const handleSeek = useCallback(
    (timeSec: number) => {
      if (simSession.videoFile && videoRef.current) {
        videoRef.current.currentTime = timeSec;
      }
      syncEngine.seek(timeSec);
      setCurrentTimeSec(timeSec);
    },
    [simSession.videoFile, syncEngine]
  );

  // ---------------------------------------------------------------------------
  // CSV parsed
  // ---------------------------------------------------------------------------

  const handleCsvParsed = useCallback((result: ParseResult) => {
    setSourceFormat(result.format);
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

  // ---------------------------------------------------------------------------
  // Video file selected
  // ---------------------------------------------------------------------------

  const handleVideoFileSelect = useCallback((file: File) => {
    setSession((prev) => ({ ...prev, videoFile: file }));
  }, []);

  // ---------------------------------------------------------------------------
  // Cleanup on unmount: stop playback
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      syncEngine.stop();
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const hasRows = simSession.rows.length > 0;
  const isDisabled = !hasRows;

  const currentRow = hasRows
    ? simSession.rows[Math.min(simSession.currentRowIndex, simSession.rows.length - 1)]
    : null;

  const rawDataItems = currentRow
    ? [
        { label: "Timestamp", value: `${currentRow.timestampSec.toFixed(2)} s` },
        { label: "Latitude", value: currentRow.latitude.toFixed(6) },
        { label: "Longitude", value: currentRow.longitude.toFixed(6) },
        { label: "Velocidade", value: `${currentRow.speed_kmh.toFixed(1)} km/h` },
        { label: "Roll", value: `${currentRow.roll_deg.toFixed(1)}°` },
        { label: "Pitch", value: `${currentRow.pitch_deg.toFixed(1)}°` },
        { label: "Yaw", value: `${currentRow.yaw_deg.toFixed(1)}°` },
        { label: "G-Force", value: currentRow.g_force.toFixed(2) },
      ]
    : [];

  const complementedDataItems = currentRow
    ? [
        { label: "RPM", value: Math.round(currentRow.rpm).toString() },
        { label: "Mudança", value: Math.round(currentRow.gear).toString() },
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
          Simulador Real
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
          Reproduz ficheiros CSV de telemetria sincronizados com vídeo .mp4
        </p>
      </div>

      {/* CSV import */}
      <CsvDropzone onParsed={handleCsvParsed} />

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {socketError}
        </div>
      )}

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
          <div
            style={{
              padding: "12px 14px",
              border: "1px solid rgba(34,197,94,0.35)",
              borderRadius: 8,
              background: "rgba(34,197,94,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#86efac" }}>Dados Reais (ficheiro)</h2>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#bbf7d0" }}>
              Valores lidos diretamente do CSV ({sourceFormat === "riderdata" ? "RiderData" : "Genérico"}).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {rawDataItems.map((item) => (
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#ecfdf5" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: "12px 14px",
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 8,
              background: "rgba(59,130,246,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#93c5fd" }}>
              Dados Complementados (simulador)
            </h2>
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#bfdbfe" }}>
              Valores calculados a partir dos dados reais para completar a telemetria da moto.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              {complementedDataItems.map((item) => (
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
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#eff6ff" }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Split layout: RouteMap (left ≥50%) + VideoPlayer (right) */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flex: 1,
          minHeight: 320,
        }}
      >
        {/* RouteMap — left, ≥50% */}
        <div style={{ flex: "0 0 55%", minWidth: 0 }}>
          <RouteMap
            gpsTrack={gpsTrack}
            currentPosition={simSession.playbackState === "playing" ? currentPosition : null}
          />
        </div>

        {/* VideoPlayer — right */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <VideoPlayer
            videoFile={simSession.videoFile}
            videoRef={videoRef}
            onFileSelect={handleVideoFileSelect}
          />
        </div>
      </div>

      {/* Playback controls */}
      <PlaybackControls
        playbackState={simSession.playbackState}
        playbackSpeed={simSession.playbackSpeed}
        currentTimeSec={currentTimeSec}
        totalDurationSec={totalDurationSec}
        emittedCount={simSession.emittedCount}
        deviceId={simSession.deviceId}
        disabled={isDisabled}
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
