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
import { motorcyclesAPI } from "../services/api";
import type { Motorcycle } from "../types";
import { Navigation, AlertTriangle, Activity, Zap, Mountain } from "lucide-react";

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
  deviceId: "",
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
  const [motorcycles, setMotorcycles] = useState<Motorcycle[]>([]);
  const [selectedMotorcycle, setSelectedMotorcycle] = useState<Motorcycle | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const simulationStartTimeRef = useRef<Date>(new Date());

  // Dummy video ref (useSyncEngine requires it but we pass null)
  const videoRef = useRef<HTMLVideoElement>(null) as RefObject<HTMLVideoElement>;

  useEffect(() => {
    document.title = "Simulador GPX — MotoGuard";
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
    onEnd: () => {
      // Quando termina naturalmente, fazemos o mesmo que o Stop mas sem chamar syncEngine.stop()
      // (evitando recursão/circularidade)
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

  const handlePlay = useCallback(() => {
    if (!socketRef.current?.connected) {
      setSocketError("Socket não conectado. Simulação sem emissão de telemetria.");
    } else {
      setSocketError(null);
      if (user?.id) {
        socketRef.current.emit("send_command", {
          acao: "definir_modelo",
          modelo: selectedMotorcycle?.name || "GPX Simulator",
          device_id: simSession.deviceId,
          userId: user.id
        });
      }
    }
    simulationStartTimeRef.current = new Date();
    syncEngine.start();
    setSession((prev) => ({ ...prev, playbackState: "playing" }));
  }, [syncEngine, user?.id, simSession.deviceId, selectedMotorcycle?.name]);

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
    <div className="flex flex-col gap-8 animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black text-text tracking-tight m-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-lg">
              <Navigation size={24} />
            </span>
            Simulador GPX
          </h1>
          <p className="text-muted font-medium text-sm">Reproduz rotas GPX com telemetria enriquecida e emissão em tempo real.</p>
        </div>
      </div>

      {/* GPX DROPZONE */}
      <div className="relative group">
        <div className="absolute inset-0 bg-accent/5 blur-2xl rounded-[2.5rem] -z-10 group-hover:bg-accent/10 transition-all" />
        <GpxDropzone onParsed={handleGpxParsed} />
      </div>

      {/* SOCKET ERROR */}
      {socketError && (
        <div className="p-4 rounded-2xl bg-red/10 border border-red/20 text-red text-xs font-bold flex items-center gap-3 animate-shake">
          <AlertTriangle size={18} />
          <span>{socketError}</span>
        </div>
      )}

      {/* DATA PANELS */}
      {hasRows && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* GPS DATA */}
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green/0 via-green/40 to-green/0 opacity-50" />
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-white tracking-tight m-0 flex items-center gap-2">
                  <Activity className="text-green" size={20} /> Dados GPS (Ficheiro)
                </h2>
                <p className="text-[0.65rem] font-medium text-muted uppercase tracking-widest opacity-60">Valores originais do percurso GPX</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {gpsDataItems.map((item) => (
                <div key={item.label} className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 shadow-inner group/item hover:border-white/10 transition-all">
                  <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40 group-hover/item:text-green/60 transition-colors">{item.label}</span>
                  <span className="text-sm font-black text-white tabular-nums group-hover/item:text-green transition-colors">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ENRICHED DATA */}
          <div className="bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue/0 via-blue/40 to-blue/0 opacity-50" />
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-black text-white tracking-tight m-0 flex items-center gap-2">
                  <Zap className="text-blue" size={20} /> Telemetria Simulada
                </h2>
                <p className="text-[0.65rem] font-medium text-muted uppercase tracking-widest opacity-60">Física enriquecida e saúde do motor</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {enrichedDataItems.map((item) => (
                <div key={item.label} className="bg-black/20 border border-white/5 rounded-2xl p-4 flex flex-col gap-1 shadow-inner group/item hover:border-white/10 transition-all">
                  <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40 group-hover/item:text-blue/60 transition-colors">{item.label}</span>
                  <span className="text-sm font-black text-white tabular-nums group-hover/item:text-blue transition-colors">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Elevation Profile */}
            {gpxStats && (
              <div className="mt-2 p-4 rounded-2xl bg-blue/5 border border-blue/10 flex items-center justify-between group/ele">
                <div className="flex flex-col gap-1">
                  <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-60 group-hover/ele:text-blue/60 transition-colors">Perfil de Elevação</span>
                  <div className="text-[0.7rem] font-bold text-blue/80 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Mountain size={12} /> {gpxStats.minElevation}m – {gpxStats.maxElevation}m</span>
                    <span className="w-px h-3 bg-blue/10" />
                    <span>↗ +{gpxStats.elevationGain}m</span>
                    <span className="w-px h-3 bg-blue/10" />
                    <span>↘ -{gpxStats.elevationLoss}m</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROUTE MAP */}
      <div className="relative flex-1 min-h-[450px] bg-surface/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-50 z-10" />
        <RouteMap
          gpsTrack={gpsTrack}
          currentPosition={simSession.playbackState === "playing" ? currentPosition : null}
        />
        {!hasRows && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-[2px] pointer-events-none z-10 animate-fade-in">
            <div className="text-7xl grayscale opacity-20">🗺️</div>
            <p className="text-sm font-black text-white/40 uppercase tracking-widest">Carrega um percurso para visualizar o mapa</p>
          </div>
        )}
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
          disabled={!hasRows}
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
