// =============================================================================
// MotoGuard IoT — Real Simulator Page
// =============================================================================
// Orquestra CsvDropzone, RouteMap, VideoPlayer, PlaybackControls e useSyncEngine
// para reproduzir ficheiros CSV de telemetria sincronizados com vídeo .mp4.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { io, Socket } from "socket.io-client";
import type { ParsedRow, ParseResult } from "../real-simulator/csvParser";
import CsvDropzone from "../real-simulator/CsvDropzone";
import RouteMap from "../real-simulator/RouteMap";
import VideoPlayer from "../real-simulator/VideoPlayer";
import { PlaybackControls } from "../real-simulator/PlaybackControls";
import { useSyncEngine } from "../real-simulator/useSyncEngine";
import { buildPayload, emitTelemetry } from "../real-simulator/telemetryEmitter";
import { useAuth } from "../hooks/useAuth";
import { motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import { Activity, Database, Zap, AlertTriangle } from "lucide-react";

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
  deviceId: "",
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
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState<Motorcycle | null>(null);

  // Socket for emitting telemetry
  const socketRef = useRef<Socket | null>(null);

  // Video element ref (passed to VideoPlayer and useSyncEngine)
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  // simulationStartTime is set when Play is first clicked
  const simulationStartTimeRef = useRef<Date>(new Date());

  // Set document title on mount
  useEffect(() => {
    document.title = "Simulador Real — MotoGuard";
  }, []);

  // Fetch motorcycles and Socket lifecycle
  useEffect(() => {
    motorcyclesAPI.getAll().then((res) => {
      setMotorcycles(res.data);
      if (res.data.length > 0) {
        setSelectedMotorcycle(res.data[0]);
        setSession(prev => ({ ...prev, deviceId: res.data[0].deviceId || "" }));
      }
    });

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
          modelo: selectedMotorcycle?.name || "Real Simulator",
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
  }, [simSession.videoFile, simSession.playbackSpeed, syncEngine, user?.id, simSession.deviceId, selectedMotorcycle?.name]);

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
  }, [syncEngine]);

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
    <div className="flex flex-col gap-8 animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-white tracking-tight m-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-lg">
              <Activity size={24} />
            </span>
            Simulador Real
          </h1>
          <p className="text-muted font-medium text-sm">Reproduz telemetria CSV sincronizada com vídeo para análise profissional.</p>
        </div>
      </div>

      {/* CSV DROPZONE */}
      <div className="relative group">
        <div className="absolute inset-0 bg-accent/5 blur-2xl rounded-[2.5rem] -z-10 group-hover:bg-accent/10 transition-all" />
        <CsvDropzone onParsed={handleCsvParsed} />
      </div>

      {/* SOCKET ERROR */}
      {socketError && (
        <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-xs font-bold flex items-center gap-3 animate-shake">
          <AlertTriangle size={18} />
          <span>{socketError}</span>
        </div>
      )}

      {/* DATA HUD */}
      {hasRows && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* REAL DATA */}
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green/0 via-green/40 to-green/0 opacity-50" />
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-white tracking-tight m-0 flex items-center gap-2">
                  <Database className="text-green" size={20} /> Dados Reais (CSV)
                </h2>
                <p className="text-[0.65rem] font-medium text-muted uppercase tracking-widest opacity-60">Formato: {sourceFormat === "riderdata" ? "RiderData" : "Genérico"}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {rawDataItems.map((item) => (
                <div key={item.label} className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 shadow-inner group/item hover:border-white/10 transition-all">
                  <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40 group-hover/item:text-green/60 transition-colors">{item.label}</span>
                  <span className="text-sm font-black text-white tabular-nums group-hover/item:text-green transition-colors">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COMPLEMENTED DATA */}
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue/0 via-blue/40 to-blue/0 opacity-50" />
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-white tracking-tight m-0 flex items-center gap-2">
                  <Zap className="text-blue" size={20} /> Telemetria Complementar
                </h2>
                <p className="text-[0.65rem] font-medium text-muted uppercase tracking-widest opacity-60">Física do motor e sensores auxiliares</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {complementedDataItems.map((item) => (
                <div key={item.label} className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 shadow-inner group/item hover:border-white/10 transition-all">
                  <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40 group-hover/item:text-blue/60 transition-colors">{item.label}</span>
                  <span className="text-sm font-black text-white tabular-nums group-hover/item:text-blue transition-colors">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SPLIT LAYOUT: MAP & VIDEO */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 flex-1 min-h-[400px]">
        {/* MAP */}
        <div className="relative bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50 z-10" />
          <RouteMap
            gpsTrack={gpsTrack}
            currentPosition={simSession.playbackState === "playing" ? currentPosition : null}
          />
          {!hasRows && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10">
              <div className="text-7xl grayscale opacity-20">🗺️</div>
              <p className="text-sm font-black text-white/40 uppercase tracking-widest">Carrega um CSV para visualizar o percurso</p>
            </div>
          )}
        </div>

        {/* VIDEO PLAYER */}
        <div className="relative bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red/0 via-red/40 to-red/0 opacity-50 z-10" />
          <div className="flex-1">
            <VideoPlayer
              videoFile={simSession.videoFile}
              videoRef={videoRef}
              onFileSelect={handleVideoFileSelect}
            />
          </div>
        </div>
      </div>

      {/* PLAYBACK CONTROLS */}
      <div className="sticky bottom-0 z-50">
        <PlaybackControls
          playbackState={simSession.playbackState}
          playbackSpeed={simSession.playbackSpeed}
          currentTimeSec={currentTimeSec}
          totalDurationSec={totalDurationSec}
          emittedCount={simSession.emittedCount}
          deviceId={simSession.deviceId}
          disabled={isDisabled}
          motorcycles={motorcycles}
          onPlay={handlePlay}
          onPause={handlePause}
          onStop={handleStop}
          onSpeedChange={handleSpeedChange}
          onDeviceIdChange={(id) => setSession((prev) => ({ ...prev, deviceId: id }))}
          onMotorcycleChange={(m) => setSelectedMotorcycle(m)}
          onSeek={handleSeek}
        />
      </div>
    </div>
  );
}
